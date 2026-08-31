import { ok, fail, HttpError, hashToken, issueToken, hashPassword } from '../server.js'

/**
 * Module 1 — Authentication.
 * Mirrors backend/routes/api.php auth group (Phase 2).
 */
export function authRoutes(router) {
  // POST /api/login
  router.post('/api/login', (ctx) => {
    const { login, password } = ctx.body || {}

    if (!login || !password) {
      throw new HttpError(422, 'Validation failed', {
        login: !login ? ['The login field is required.'] : [],
        password: !password ? ['The password field is required.'] : [],
      })
    }

    const user = ctx.db
      .prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND deleted_at IS NULL')
      .get(login, login)

    if (!user || user.password_hash !== hashPassword(password)) {
      throw new HttpError(401, 'Invalid credentials.')
    }
    if (user.status !== 'active') {
      throw new HttpError(403, 'Your account is deactivated. Please contact the administrator.')
    }

    const token = issueToken(ctx.db, user.id)
    return ok('Login successful.', {
      token,
      user: router.serializeUser(user),
    })
  })

  // POST /api/logout
  router.post('/api/logout', (ctx) => {
    if (ctx.token) {
      ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(ctx.token))
    }
    return ok('Logged out successfully.')
  }, { auth: true })

  // GET /api/me
  router.get('/api/me', (ctx) => {
    return ok('Authenticated user retrieved successfully.', {
      user: router.serializeUser(ctx.user),
    })
  }, { auth: true })

  // POST /api/change-password
  router.post('/api/change-password', (ctx) => {
    const { current_password, new_password, new_password_confirmation } = ctx.body || {}
    const errors = {}

    if (!current_password) errors.current_password = ['The current password field is required.']
    if (!new_password) errors.new_password = ['The new password field is required.']
    else if (new_password.length < 8) errors.new_password = ['The new password must be at least 8 characters.']
    if (new_password !== new_password_confirmation) {
      errors.new_password_confirmation = ['The password confirmation does not match.']
    }
    if (Object.keys(errors).length) throw new HttpError(422, 'Validation failed', errors)

    if (ctx.user.password_hash !== hashPassword(current_password)) {
      throw new HttpError(422, 'Validation failed', {
        current_password: ['The current password is incorrect.'],
      })
    }

    ctx.db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashPassword(new_password), new Date().toISOString(), ctx.user.id)

    // Revoke other sessions (keep the current one).
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(ctx.user.id, hashToken(ctx.token))

    return ok('Password changed successfully.')
  }, { auth: true })
}

export { fail }
