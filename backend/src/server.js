import dotenv from 'dotenv'
dotenv.config()

import http from 'http'
import { Server as IOServer } from 'socket.io'
import app from './app.js'
import setupSocket from './config/socket.js'
import { startScheduler } from './config/scheduler.js'

const PORT = process.env.PORT || 5000

const server = http.createServer(app)
const io = new IOServer(server)

setupSocket(io)

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
  try {
    startScheduler()
    console.log('Scheduler started')
  } catch (err) {
    console.error('Failed to start scheduler:', err)
  }
})
