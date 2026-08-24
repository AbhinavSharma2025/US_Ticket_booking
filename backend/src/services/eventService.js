import prisma from '../config/db.js'

export async function createEvent({ title, description, type, organiserId }) {
  if (!title || typeof title !== 'string') {
    const err = new Error('title is required')
    err.statusCode = 400
    throw err
  }
  if (!['MOVIE', 'CONCERT'].includes(type)) {
    const err = new Error('type must be MOVIE or CONCERT')
    err.statusCode = 400
    throw err
  }

  const event = await prisma.event.create({
    data: { title, description, type, organiserId },
  })

  return event
}

export async function listEvents({ type, from, to } = {}) {
  const where = {}
  if (type) where.type = type

  if (from || to) {
    const dateFilter = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to)

    where.shows = { some: { date: dateFilter } }
  }

  return prisma.event.findMany({
    where,
    include: {
      shows: {
        include: { venue: { select: { id: true, name: true } } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      },
    },
  })
}

export async function getEventById(id) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { shows: { include: { venue: true }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] } },
  })
  if (!event) {
    const err = new Error('Event not found')
    err.statusCode = 404
    throw err
  }
  return event
}

export default { createEvent, listEvents, getEventById }
