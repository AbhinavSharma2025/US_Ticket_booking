import prisma from '../config/db.js'

export async function createShow({ eventId, venueId, date, startTime, pricing = [], organiserId }) {
  const event = await prisma.event.findUnique({ where: { id: eventId } })
  if (!event) {
    const err = new Error('Event not found')
    err.statusCode = 404
    throw err
  }
  if (event.organiserId !== organiserId) {
    const err = new Error('Forbidden')
    err.statusCode = 403
    throw err
  }

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { seatCategories: true, seats: true },
  })
  if (!venue) {
    const err = new Error('Venue not found')
    err.statusCode = 404
    throw err
  }

  const venueCategoryNames = venue.seatCategories.map((c) => c.name)
  const providedNames = pricing.map((p) => p.categoryName)

  const missing = venueCategoryNames.filter((n) => !providedNames.includes(n))
  if (missing.length > 0) {
    const err = new Error(`Missing pricing for categories: ${missing.join(', ')}`)
    err.statusCode = 400
    throw err
  }

  const invalid = providedNames.filter((n) => !venueCategoryNames.includes(n))
  if (invalid.length > 0) {
    const err = new Error(`Unknown categor${invalid.length > 1 ? 'ies' : 'y'} in pricing: ${invalid.join(', ')}`)
    err.statusCode = 400
    throw err
  }

  const parsedDate = new Date(date)
  const parsedStartTime = new Date(startTime)
  if (isNaN(parsedDate.getTime()) || isNaN(parsedStartTime.getTime())) {
    const err = new Error('date and startTime must be valid dates')
    err.statusCode = 400
    throw err
  }

  let show
  try {
    show = await prisma.$transaction(async (tx) => {
      const created = await tx.show.create({
        data: {
          eventId,
          venueId,
          date: parsedDate,
          startTime: parsedStartTime,
        },
      })

      const categoryMap = {}
      for (const cat of venue.seatCategories) categoryMap[cat.name] = cat.id

      for (const p of pricing) {
        await tx.showSeatCategory.create({
          data: { showId: created.id, categoryId: categoryMap[p.categoryName], price: p.price },
        })
      }

      const seatCreates = venue.seats.map((s) => ({ showId: created.id, seatId: s.id, status: 'AVAILABLE' }))
      if (seatCreates.length) await tx.showSeat.createMany({ data: seatCreates })

      return created
    })
  } catch (err) {
    if (err?.code === 'P2002') {
      const e = new Error('Show seat categories already exist for this show')
      e.statusCode = 400
      throw e
    }
    throw err
  }

  const result = await prisma.show.findUnique({
    where: { id: show.id },
    include: { seatCategories: { include: { category: true } } },
  })
  const seatCount = await prisma.showSeat.count({ where: { showId: show.id } })

  return { ...result, seatCount }
}

export async function getShowById(id) {
  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      event: true,
      venue: { select: { id: true, name: true, layout: true } },
      seatCategories: { include: { category: { select: { name: true } } } },
    },
  })

  if (!show) {
    const err = new Error('Show not found')
    err.statusCode = 404
    throw err
  }

  const seats = await prisma.showSeat.findMany({
    where: { showId: id },
    select: {
      id: true,
      status: true,
      seat: { select: { rowLabel: true, seatNumber: true, category: { select: { name: true } } } },
    },
    orderBy: [{ seat: { rowLabel: 'asc' } }, { seat: { seatNumber: 'asc' } }],
  })

  const seatCategories = show.seatCategories.map((ssc) => ({
    id: ssc.id,
    categoryName: ssc.category.name,
    price: ssc.price,
  }))

  return { ...show, seats, seatCategories }
}

export default { createShow, getShowById }