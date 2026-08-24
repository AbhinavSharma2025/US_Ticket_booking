import express from 'express'
import * as holdController from '../controllers/holdController.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router({ mergeParams: true })

router.post('/', authenticate, requireRole('CUSTOMER'), holdController.create)
router.delete('/', authenticate, requireRole('CUSTOMER'), holdController.release)

export default router
