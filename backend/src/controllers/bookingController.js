import * as bookingService from '../services/bookingService.js'

export async function create(req, res, next) {
  try {
    const userId = req.user?.userId
    const showId = req.params.showId
    const seatIds = req.body.seatIds
    const booking = await bookingService.confirmBooking({ showId, seatIds, userId })
    res.json(booking)
  } catch (err) {
    next(err)
  }
}

export async function listMine(req, res, next) {
  try {
    const userId = req.user?.userId
    const bookings = await bookingService.getBookingsByUser(userId)
    res.json(bookings)
  } catch (err) {
    next(err)
  }
}

export async function cancel(req, res, next) {
  try {
    const userId = req.user?.userId
    const bookingId = req.params.id
    const cancelled = await bookingService.cancelBooking({ bookingId, userId })
    res.json(cancelled)
  } catch (err) {
    next(err)
  }
}

export default { create, listMine, cancel }
