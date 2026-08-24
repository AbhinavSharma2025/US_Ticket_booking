import express from 'express'
import cors from 'cors'
import errorHandler from './middleware/errorHandler.js'
import authRoutes from './routes/authRoutes.js'
import venueRoutes from './routes/venueRoutes.js'
import eventRoutes from './routes/eventRoutes.js'
import showRoutes from './routes/showRoutes.js'
import holdRoutes from './routes/holdRoutes.js'
import bookingRoutes from './routes/bookingRoutes.js'
import myBookingRoutes from './routes/myBookingRoutes.js'
import waitlistRoutes from './routes/waitlistRoutes.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Auth routes
app.use('/api/auth', authRoutes)

// Venue routes
app.use('/api/venues', venueRoutes)

// Event routes
app.use('/api/events', eventRoutes)

// Hold routes (mounted per-show)
app.use('/api/shows/:showId/holds', holdRoutes)

// Booking creation (per-show)
app.use('/api/shows/:showId/bookings', bookingRoutes)

// Waitlist
app.use('/api/shows/:showId/waitlist', waitlistRoutes)

// Show routes
app.use('/api/shows', showRoutes)

// My bookings
app.use('/api/bookings', myBookingRoutes)

app.use(errorHandler)

export default app
