import prisma from '../config/db.js'
import { getIO } from '../config/socket.js'
import { sendWaitlistOfferEmail } from '../config/mailer.js'

export async function joinWaitlist({ showId, categoryId, userId }) {
  // Verify show and category belong to show
  const ssc = await prisma.showSeatCategory.findFirst({ where: { showId, categoryId } })
  if (!ssc) {
    const err = new Error('Show or category not found')
    err.statusCode = 404
    throw err
  }

  // If seats available in this category, don't allow join
  const availableCount = await prisma.showSeat.count({ where: { showId, status: 'AVAILABLE', seat: { is: { categoryId } } } })
  if (availableCount > 0) {
    const err = new Error('Seats are still available in this category, no need to join waitlist')
    err.statusCode = 400
    throw err
  }

  // Check if user already on waitlist (WAITING or OFFERED)
  const existing = await prisma.waitlistEntry.findFirst({ where: { showId, categoryId, userId, status: { in: ['WAITING', 'OFFERED'] } } })
  if (existing) {
    const err = new Error('Already on waitlist for this category')
    err.statusCode = 400
    throw err
  }

  const count = await prisma.waitlistEntry.count({ where: { showId, categoryId } })
  const position = count + 1

  const entry = await prisma.waitlistEntry.create({ data: { showId, categoryId, userId, status: 'WAITING', position } })
  return entry
}

export async function assignSeatFromWaitlistOrRelease({ showSeatId, showId, categoryId }) {
  // Attempt to assign in a loop to handle races
  while (true) {
    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.waitlistEntry.findFirst({ where: { showId, categoryId, status: 'WAITING' }, orderBy: { position: 'asc' } })
      if (!entry) {
        await tx.showSeat.updateMany({ where: { id: showSeatId, showId }, data: { status: 'AVAILABLE', heldById: null, heldUntil: null } })
        return { assigned: false }
      }

      const offerExpiresAt = new Date(Date.now() + parseFloat(process.env.SEAT_HOLD_TTL_MINUTES || '10') * 60000)
      const updated = await tx.waitlistEntry.updateMany({ where: { id: entry.id, status: 'WAITING' }, data: { status: 'OFFERED', offeredAt: new Date(), offerExpiresAt } })
      if (updated.count !== 1) {
        return { retry: true }
      }

      await tx.showSeat.updateMany({ where: { id: showSeatId, showId }, data: { status: 'HELD', heldById: entry.userId, heldUntil: offerExpiresAt } })
      return { assigned: true, entry, offerExpiresAt }
    })

    if (result.retry) continue

    if (!result.assigned) {
      // emit available
      try {
        const io = getIO()
        io.to(`show:${showId}`).emit('seatStatusUpdate', { seats: [{ id: showSeatId, status: 'AVAILABLE' }] })
      } catch (err) { console.error('Socket emit failed:', err.message) }
      return { assigned: false }
    }

    // assigned true: send email to entry.user and emit held
    try {
      const show = await prisma.show.findUnique({ where: { id: showId }, include: { event: true, venue: true } })
      const showSeat = await prisma.showSeat.findUnique({ where: { id: showSeatId }, include: { seat: true } })
      const user = await prisma.user.findUnique({ where: { id: result.entry.userId } })

      if (user?.email) {
        try {
          await sendWaitlistOfferEmail({ to: user.email, show, showSeat, offerExpiresAt: result.offerExpiresAt })
        } catch (err) { console.error('sendWaitlistOfferEmail error:', err) }
      }

      try {
        const io = getIO()
        io.to(`show:${showId}`).emit('seatStatusUpdate', { seats: [{ id: showSeatId, status: 'HELD' }] })
      } catch (err) { console.error('Socket emit failed:', err.message) }

      return { assigned: true, entry: result.entry, offerExpiresAt: result.offerExpiresAt }
    } catch (err) {
      console.error('Error post-assignment:', err)
      return { assigned: false }
    }
  }
}

export default { joinWaitlist, assignSeatFromWaitlistOrRelease }
