import waitlistService from '../services/waitlistService.js'

export async function join(req, res, next) {
  try {
    const userId = req.user?.userId
    const showId = req.params.showId
    const { categoryId } = req.body
    const entry = await waitlistService.joinWaitlist({ showId, categoryId, userId })
    res.json(entry)
  } catch (err) {
    next(err)
  }
}

export default { join }
