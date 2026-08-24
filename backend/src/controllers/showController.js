import * as showService from '../services/showService.js'

export async function create(req, res, next) {
  try {
    const organiserId = req.user?.userId
    const payload = { ...req.body, eventId: req.params.eventId, organiserId }
    const show = await showService.createShow(payload)
    res.json(show)
  } catch (err) {
    next(err)
  }
}

export async function getOne(req, res, next) {
  try {
    const show = await showService.getShowById(req.params.id)
    res.json(show)
  } catch (err) {
    next(err)
  }
}

export default { create, getOne }
