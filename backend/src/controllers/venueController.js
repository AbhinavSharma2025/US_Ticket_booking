import * as venueService from '../services/venueService.js'

export async function create(req, res, next) {
  try {
    const createdById = req.user?.userId
    const payload = { ...req.body, createdById }
    const venue = await venueService.createVenue(payload)
    res.json(venue)
  } catch (err) {
    next(err)
  }
}

export async function list(req, res, next) {
  try {
    const venues = await venueService.listVenues()
    res.json(venues)
  } catch (err) {
    next(err)
  }
}

export async function getOne(req, res, next) {
  try {
    const venue = await venueService.getVenueById(req.params.id)
    res.json(venue)
  } catch (err) {
    next(err)
  }
}

export async function update(req, res, next) {
  try {
    const updated = await venueService.updateVenue(req.params.id, req.body)
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

export default { create, list, getOne, update }
