import authService from '../services/authService.js'

export async function register(req, res, next) {
  try {
    const { user, token } = await authService.registerUser(req.body)
    res.json({ user, token })
  } catch (err) {
    next(err)
  }
}

export async function login(req, res, next) {
  try {
    const { user, token } = await authService.loginUser(req.body)
    res.json({ user, token })
  } catch (err) {
    next(err)
  }
}

export default { register, login }
