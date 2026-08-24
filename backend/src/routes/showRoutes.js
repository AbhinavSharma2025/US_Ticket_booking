import express from 'express'
import * as showController from '../controllers/showController.js'

const router = express.Router()

router.get('/:id', showController.getOne)

export default router
