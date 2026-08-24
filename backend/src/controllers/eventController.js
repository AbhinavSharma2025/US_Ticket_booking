import * as eventService from '../services/eventService.js'

export async function create(req, res, next) {
  try {
    const organiserId = req.user?.userId
    const event = await eventService.createEvent({ ...req.body, organiserId })
    res.json(event)
  } catch (err) {
    next(err)
  }
}

export async function list(req, res, next) {
  try {
    const events = await eventService.listEvents(req.query)
    res.json(events)
  } catch (err) {
    next(err)
  }
}

export async function getOne(req, res, next) {
  try {
    const event = await eventService.getEventById(req.params.id)
    res.json(event)
  } catch (err) {
    next(err)
  }
}

export default { create, list, getOne }
