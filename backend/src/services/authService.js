import bcrypt from 'bcryptjs'
import prisma from '../config/db.js'
import { signToken } from '../utils/jwt.js'

export async function registerUser({ name, email, password, role = 'CUSTOMER' }) {
  if (!name || !email || !password) {
    const err = new Error('name, email, and password are required')
    err.statusCode = 400
    throw err
  }

  if (password.length < 6) {
    const err = new Error('Password must be at least 6 characters')
    err.statusCode = 400
    throw err
  }

  if (role === 'ADMIN') {
    const err = new Error('Cannot assign ADMIN role')
    err.statusCode = 400
    throw err
  }

  const passwordHash = await bcrypt.hash(password, 10)

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
    })

    const token = signToken({ userId: user.id, role: user.role })
    const safeUser = { ...user }
    delete safeUser.passwordHash
    return { user: safeUser, token }
  } catch (err) {
    // Prisma unique constraint error code
    if (err?.code === 'P2002') {
      const e = new Error('Email already in use')
      e.statusCode = 400
      throw e
    }
    throw err
  }
}

export async function loginUser({ email, password }) {
  if (!email || !password) {
    const err = new Error('email and password are required')
    err.statusCode = 400
    throw err
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    const err = new Error('Invalid credentials')
    err.statusCode = 401
    throw err
  }

  const match = await bcrypt.compare(password, user.passwordHash)
  if (!match) {
    const err = new Error('Invalid credentials')
    err.statusCode = 401
    throw err
  }

  const token = signToken({ userId: user.id, role: user.role })
  const safeUser = { ...user }
  delete safeUser.passwordHash
  return { user: safeUser, token }
}

export default { registerUser, loginUser }
