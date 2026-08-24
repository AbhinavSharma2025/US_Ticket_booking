import express from 'express'
import * as waitlistController from '../controllers/waitlistController.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router({ mergeParams: true })

router.post('/', authenticate, requireRole('CUSTOMER'), waitlistController.join)

export default router
