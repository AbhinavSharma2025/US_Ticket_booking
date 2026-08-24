import prisma from '../config/db.js'
import { getIO } from '../config/socket.js'

export async function createHold({ showId, seatIds, userId }) {
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    const err = new Error('seatIds must be a non-empty array')
    err.statusCode = 400
    throw err
  }

  // remove duplicate seat IDs to avoid conflicts when client sends duplicates
  seatIds = [...new Set(seatIds)]

  const ttlMinutes = parseFloat(process.env.SEAT_HOLD_TTL_MINUTES || '10', 10)
  const heldUntil = new Date(Date.now() + ttlMinutes * 60 * 1000)

  // Perform atomic updates inside a transaction. If any seat is not AVAILABLE,
  // throw to roll back all changes.
  try {
    await prisma.$transaction(async (tx) => {
      for (const seatId of seatIds) {
        const res = await tx.showSeat.updateMany({
          where: { id: seatId, showId, status: 'AVAILABLE' },
          data: { status: 'HELD', heldById: userId, heldUntil },
        })
        if (res.count !== 1) {
          const e = new Error(`Seat ${seatId} is no longer available`)
          e.statusCode = 409
          throw e
        }
      }
    })
  } catch (err) {
    throw err
  }

  // Fetch updated show seats
  const heldSeats = await prisma.showSeat.findMany({
    where: { id: { in: seatIds } },
    include: { seat: { select: { rowLabel: true, seatNumber: true } } },
  })

  // Emit seat status update via Socket.io
  try {
    const io = getIO()
    const payload = { seats: heldSeats.map((s) => ({ id: s.id, status: s.status })) }
    io.to(`show:${showId}`).emit('seatStatusUpdate', payload)
  } catch (err) {
    // If sockets aren't ready, do not fail the hold — log and continue.
    console.error('Socket emit failed:', err.message)
  }

  return { heldSeats, heldUntil }
}

export async function releaseHold({ showId, seatIds, userId }) {
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return { releasedCount: 0 }
  }

  let releasedCount = 0
  for (const seatId of seatIds) {
    const res = await prisma.showSeat.updateMany({
      where: { id: seatId, showId, heldById: userId, status: 'HELD' },
      data: { status: 'AVAILABLE', heldById: null, heldUntil: null },
    })
    releasedCount += res.count
  }

  // Fetch seats that are now available among the provided ids
  const releasedSeats = await prisma.showSeat.findMany({
    where: { id: { in: seatIds }, showId, status: 'AVAILABLE' },
  })

  // Emit seat status update for released seats
  try {
    const io = getIO()
    const payload = { seats: releasedSeats.map((s) => ({ id: s.id, status: s.status })) }
    io.to(`show:${showId}`).emit('seatStatusUpdate', payload)
  } catch (err) {
    console.error('Socket emit failed:', err.message)
  }

  return { releasedCount }
}

export default { createHold, releaseHold }
