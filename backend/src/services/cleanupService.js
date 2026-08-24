import prisma from '../config/db.js'
import { getIO } from '../config/socket.js'
import waitlistService from './waitlistService.js'

export async function releaseExpiredHolds() {
  try {
    const now = new Date()
    const heldSeats = await prisma.showSeat.findMany({
      where: { status: 'HELD', heldUntil: { lt: now } },
      select: { id: true, showId: true, heldById: true, seat: { select: { categoryId: true } } },
    })

    if (!heldSeats || heldSeats.length === 0) return

    // Process each expired held seat: if it was an OFFERED waitlist entry for that user, expire it and assign to next, otherwise release.
    let totalReleased = 0
    for (const s of heldSeats) {
      const seatId = s.id
      const showId = s.showId
      const heldById = s.heldById
      const categoryId = s.seat?.categoryId

      let handled = false
      if (heldById && categoryId) {
        // check for matching OFFERED waitlist entry for this hold (the user who was offered)
        const offered = await prisma.waitlistEntry.findFirst({ where: { showId, categoryId, userId: heldById, status: 'OFFERED' } })
        if (offered) {
          // mark that offered entry as EXPIRED
          await prisma.waitlistEntry.update({ where: { id: offered.id }, data: { status: 'EXPIRED' } })
          // attempt to assign this seat to next waitlist member or release
          try {
            await waitlistService.assignSeatFromWaitlistOrRelease({ showSeatId: seatId, showId, categoryId })
          } catch (err) {
            console.error('Error assigning from waitlist during cleanup:', err)
          }
          handled = true
          totalReleased += 1
        }
      }

      if (!handled) {
        // ordinary expired hold — release seat and emit
        try {
          await prisma.showSeat.updateMany({ where: { id: seatId }, data: { status: 'AVAILABLE', heldById: null, heldUntil: null } })
          try {
            const io = getIO()
            io.to(`show:${showId}`).emit('seatStatusUpdate', { seats: [{ id: seatId, status: 'AVAILABLE' }] })
          } catch (emitErr) {
            console.error('Failed to emit seatStatusUpdate:', emitErr.message)
          }
          totalReleased += 1
        } catch (err) {
          console.error('Failed to release expired seat:', err)
        }
      }
    }

    console.log(`Released ${totalReleased} expired holds`)
  } catch (err) {
    console.error('Error in releaseExpiredHolds:', err)
  }
}

export default { releaseExpiredHolds }
