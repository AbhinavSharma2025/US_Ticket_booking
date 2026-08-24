import express from 'express'
import * as bookingController from '../controllers/bookingController.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router({ mergeParams: true })

router.post('/', authenticate, requireRole('CUSTOMER'), bookingController.create)

export default router
