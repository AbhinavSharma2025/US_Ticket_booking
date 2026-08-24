import express from 'express'
import * as eventController from '../controllers/eventController.js'
import * as showController from '../controllers/showController.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router()

router.post('/', authenticate, requireRole('ORGANISER'), eventController.create)
router.get('/', eventController.list)
router.get('/:id', eventController.getOne)
router.post('/:eventId/shows', authenticate, requireRole('ORGANISER'), showController.create)

export default router
