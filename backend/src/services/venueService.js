import prisma from '../config/db.js'

export async function createVenue({ name, address, layout, createdById }) {
  if (!name || !address || !layout || !Array.isArray(layout.rows)) {
    const err = new Error('name, address, and layout.rows are required')
    err.statusCode = 400
    throw err
  }

  // Validate rows structure
  for (const row of layout.rows) {
    if (typeof row.rowLabel !== 'string' || !Array.isArray(row.seats)) {
      const err = new Error('Each row must have rowLabel (string) and seats (array)')
      err.statusCode = 400
      throw err
    }
    if (!row.category || typeof row.category !== 'string') {
      const err = new Error('Each row must include a category name')
      err.statusCode = 400
      throw err
    }
    // Validate each seat entry: must be 'gap' or a positive integer
    for (const entry of row.seats) {
      if (entry === 'gap') continue
      const num = Number(entry)
      if (Number.isNaN(num) || !Number.isInteger(num) || num <= 0) {
        const e = new Error(`Invalid seat entry in row ${row.rowLabel}: ${entry}`)
        e.statusCode = 400
        throw e
      }
    }
  }

  // Collect distinct category names
  const categoryNames = Array.from(new Set(layout.rows.map((r) => r.category)))

  // Transaction: create venue, create categories, create seats
  let result
  try {
    result = await prisma.$transaction(async (tx) => {
      const venue = await tx.venue.create({
        data: {
          name,
          address,
          layout,
          createdById,
        },
      })

      // create categories and map name => category record
      const categoryMap = {}
      for (const catName of categoryNames) {
        const cat = await tx.seatCategory.create({
          data: { name: catName, venueId: venue.id },
        })
        categoryMap[catName] = cat
      }

      // create seats
      for (const row of layout.rows) {
        const category = categoryMap[row.category]
        for (const seatEntry of row.seats) {
          if (seatEntry === 'gap') continue
          const seatNumber = Number(seatEntry)
          if (Number.isNaN(seatNumber)) continue
          await tx.seat.create({
            data: {
              venueId: venue.id,
              categoryId: category.id,
              rowLabel: row.rowLabel,
              seatNumber,
            },
          })
        }
      }

      return venue
    })
  } catch (err) {
    if (err?.code === 'P2002') {
      const e = new Error('Duplicate seat number in a row')
      e.statusCode = 400
      throw e
    }
    throw err
  }

  // Return venue including seatCategories and seats (ordered)
  const created = await prisma.venue.findUnique({
    where: { id: result.id },
    include: {
      seatCategories: true,
      seats: { orderBy: [{ rowLabel: 'asc' }, { seatNumber: 'asc' }] },
    },
  })

  return created
}

export async function listVenues() {
  return prisma.venue.findMany({ include: { seatCategories: true } })
}

export async function getVenueById(id) {
  const venue = await prisma.venue.findUnique({
    where: { id },
    include: {
      seatCategories: true,
      seats: { orderBy: [{ rowLabel: 'asc' }, { seatNumber: 'asc' }] },
    },
  })
  if (!venue) {
    const err = new Error('Venue not found')
    err.statusCode = 404
    throw err
  }
  return venue
}

export async function updateVenue(id, { name, address }) {
  // We intentionally do NOT allow updating layout or seats here.
  // Changing layout after seats are created would corrupt existing seat records
  // and break references used by shows/bookings.
  const existing = await prisma.venue.findUnique({ where: { id } })
  if (!existing) {
    const err = new Error('Venue not found')
    err.statusCode = 404
    throw err
  }

  const updated = await prisma.venue.update({
    where: { id },
    data: { name, address },
  })
  return updated
}

export default { createVenue, listVenues, getVenueById, updateVenue }
