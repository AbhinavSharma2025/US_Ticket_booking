import holdService from '../services/holdService.js'

export async function create(req, res, next) {
  try {
    const userId = req.user?.userId
    const showId = req.params.showId
    const seatIds = req.body.seatIds
    const result = await holdService.createHold({ showId, seatIds, userId })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function release(req, res, next) {
  try {
    const userId = req.user?.userId
    const showId = req.params.showId
    const seatIds = req.body.seatIds
    const result = await holdService.releaseHold({ showId, seatIds, userId })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export default { create, release }
