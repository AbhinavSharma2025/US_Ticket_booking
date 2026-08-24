let _io = null

export default function setupSocket(io) {
  _io = io

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('joinShow', ({ showId }) => {
      if (showId) socket.join(`show:${showId}`)
    })

    socket.on('leaveShow', ({ showId }) => {
      if (showId) socket.leave(`show:${showId}`)
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })
}

export function getIO() {
  if (!_io) throw new Error('Socket.io has not been initialized yet')
  return _io
}
