import express from 'express'
import * as bookingController from '../controllers/bookingController.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router()

router.get('/', authenticate, requireRole('CUSTOMER'), bookingController.listMine)
router.delete('/:id', authenticate, requireRole('CUSTOMER'), bookingController.cancel)

export default router
