import prisma from '../config/db.js'
import QRCode from 'qrcode'
import { sendBookingEmail } from '../config/mailer.js'
import { getIO } from '../config/socket.js'
import waitlistService from './waitlistService.js'

export async function confirmBooking({ showId, seatIds, userId }) {
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    const err = new Error('seatIds must be a non-empty array')
    err.statusCode = 400
    throw err
  }

  // fetch show with pricing
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: { event: true, venue: true, seatCategories: true },
  })
  if (!show) {
    const err = new Error('Show not found')
    err.statusCode = 404
    throw err
  }

  // fetch showSeats
  const showSeats = await prisma.showSeat.findMany({
    where: { id: { in: seatIds } },
    include: { seat: true },
  })

  if (showSeats.length !== seatIds.length) {
    const err = new Error('One or more seats not found')
    err.statusCode = 404
    throw err
  }

  // verify holds
  for (const s of showSeats) {
    if (s.status !== 'HELD' || s.heldById !== userId) {
      const err = new Error('One or more seats are not held by you or the hold has expired')
      err.statusCode = 409
      throw err
    }
  }

  // compute totalAmount by matching seat.categoryId to show.seatCategories
  const priceMap = new Map()
  for (const sc of show.seatCategories) priceMap.set(sc.categoryId, sc.price)

  let totalAmount = 0
  for (const s of showSeats) {
    const price = priceMap.get(s.seat.categoryId)
    totalAmount += Number(price || 0)
  }

  let booking
  try {
    booking = await prisma.$transaction(async (tx) => {
      // transition seats HELD -> BOOKED
      for (const seatId of seatIds) {
        const res = await tx.showSeat.updateMany({
          where: { id: seatId, showId, heldById: userId, status: 'HELD' },
          data: { status: 'BOOKED', heldById: null, heldUntil: null },
        })
        if (res.count !== 1) {
          const e = new Error(`Seat ${seatId} could not be booked`) 
          e.statusCode = 409
          throw e
        }
      }

      const createdBooking = await tx.booking.create({
        data: { userId, showId, status: 'CONFIRMED', totalAmount },
      })

      for (const seatId of seatIds) {
        await tx.bookingSeat.create({ data: { bookingId: createdBooking.id, showSeatId: seatId } })
      }

      return createdBooking
    })
  } catch (err) {
    throw err
  }

  // generate QR code
  const qrData = JSON.stringify({ bookingId: booking.id, showId })
  const qrDataUrl = await QRCode.toDataURL(qrData)

  // update booking with qrCodeData
  await prisma.booking.update({ where: { id: booking.id }, data: { qrCodeData: qrDataUrl } })

  // fetch full booking with related data for email and return
  const fullBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: {
      show: { include: { event: true, venue: true } },
      seats: { include: { showSeat: { include: { seat: true } } } },
    },
  })

  // fetch user email
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.email) {
    try {
      await sendBookingEmail({ to: user.email, booking: fullBooking, qrDataUrl })
    } catch (err) {
      console.error('sendBookingEmail error:', err)
    }
  }

  // emit seat status updates
  try {
    const io = getIO()
    const payload = { seats: seatIds.map((id) => ({ id, status: 'BOOKED' })) }
    io.to(`show:${showId}`).emit('seatStatusUpdate', payload)
  } catch (err) {
    console.error('Socket emit failed:', err.message)
  }

  return fullBooking
}

export async function getBookingsByUser(userId) {
  return prisma.booking.findMany({
    where: { userId },
    include: {
      show: { include: { event: true, venue: true } },
      seats: { include: { showSeat: { include: { seat: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function cancelBooking({ bookingId, userId }) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { seats: { include: { showSeat: true } } },
  })
  if (!booking) {
    const err = new Error('Booking not found')
    err.statusCode = 404
    throw err
  }
  if (booking.userId !== userId) {
    const err = new Error('Forbidden')
    err.statusCode = 403
    throw err
  }
  if (booking.status === 'CANCELLED') {
    const err = new Error('Booking already cancelled')
    err.statusCode = 400
    throw err
  }

  const showSeatIds = booking.seats.map((bs) => bs.showSeatId)
  const showId = booking.seats[0]?.showSeat?.showId

  // First, mark booking cancelled in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } })
  })

  // For each showSeat, attempt to assign from waitlist or release
  for (const showSeatId of showSeatIds) {
    // fetch categoryId and showId for this seat
    const s = await prisma.showSeat.findUnique({ where: { id: showSeatId }, include: { seat: true } })
    if (!s) continue
    const categoryId = s.seat.categoryId
    const sid = s.showId
    try {
      await waitlistService.assignSeatFromWaitlistOrRelease({ showSeatId, showId: sid, categoryId })
    } catch (err) {
      console.error('Error assigning seat from waitlist:', err)
    }
  }

  const cancelled = await prisma.booking.findUnique({ where: { id: bookingId } })
  return cancelled
}

export default { confirmBooking, getBookingsByUser, cancelBooking }
