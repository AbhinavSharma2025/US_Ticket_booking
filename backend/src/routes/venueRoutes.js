import express from 'express'
import * as venueController from '../controllers/venueController.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router()

router.post('/', authenticate, requireRole('ADMIN'), venueController.create)
router.get('/', venueController.list)
router.get('/:id', venueController.getOne)
router.patch('/:id', authenticate, requireRole('ADMIN'), venueController.update)

export default router
