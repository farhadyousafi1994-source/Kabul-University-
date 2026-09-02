import { createServer } from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { openDb } from './db.js'

// ---------------------------------------------------------------------------
// KU-AMS development mock API
//
// A minimal REST server that mirrors the Laravel API contract exactly
// (routes, query semantics, response envelope). It runs inside the Vite dev
// server so the SPA is fully usable without PHP. It is DEVELOPMENT ONLY —
// production builds proxy /api to the real Laravel backend.
// ---------------------------------------------------------------------------

export class HttpError extends Error {
  constructor(status, message, errors = null) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

// `status` mirrors Laravel's ApiResponse::success(..., $status) — 201 for
// store endpoints, etc. The router reads `__status` and strips it.
export const ok = (message, data = null, meta = null, status = 200) => {
  const body = { success: true, message, data: data ?? {} }
  if (meta) body.meta = meta
  return status === 200 ? body : { ...body, __status: status }
}

export const fail = (status, message, errors = null) => ({
  success: false,
  message,
  ...(errors ? { errors } : {}),
})

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const hashPassword = (password) => sha256(`ku-ams:${password}`)
export const hashToken = (token) => sha256(`ku-token:${token}`)

const compilePath = (pattern) => {
  const names = []
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/:(\w+)/g, (_, name) => {
          names.push(name)
          return '([^/]+)'
        }) +
      '$',
  )
  return { regex, names }
}

class Router {
  constructor() {
    this.routes = []
    this.middleware = []
    this.db = openDb()
  }

  use(fn) {
    this.middleware.push(fn)
  }

  add(method, pattern, handler, options = {}) {
    const { regex, names } = compilePath(pattern)
    this.routes.push({ method, regex, names, handler, options })
  }

  get(path, handler, options = {}) { this.add('GET', path, handler, options) }
  post(path, handler, options = {}) { this.add('POST', path, handler, options) }
  put(path, handler, options = {}) { this.add('PUT', path, handler, options) }
  patch(path, handler, options = {}) { this.add('PATCH', path, handler, options) }
  delete(path, handler, options = {}) { this.add('DELETE', path, handler, options) }

  // -------------------------------------------------------------------------
  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const pathname = decodeURIComponent(url.pathname)
    const method = req.method

    let body = ''
    for await (const chunk of req) body += chunk
    let parsedBody = {}
    if (body) {
      try {
        parsedBody = JSON.parse(body)
      } catch {
        return this.send(res, 400, fail(400, 'Invalid JSON body'))
      }
    }

    for (const route of this.routes) {
      if (route.method !== method) continue
      const match = route.regex.exec(pathname)
      if (!match) continue

      const params = {}
      route.names.forEach((name, i) => { params[name] = match[i + 1] })

      const ctx = {
        req,
        res,
        db: this.db,
        params,
        query: Object.fromEntries(url.searchParams),
        body: parsedBody,
        user: null,
        token: null,
        send: (status, payload) => this.send(res, status, payload),
      }

      try {
        for (const mw of this.middleware) await mw(ctx)
        if (route.options.auth) {
          this.authenticate(ctx)
        }
        if (route.options.permission) {
          this.authorize(ctx, route.options.permission)
        }
        const result = await route.handler(ctx)
        if (result !== undefined && !res.writableEnded) {
          const { __status: status = 200, ...payload } = result || {}
          this.send(res, status, payload)
        }
      } catch (err) {
        if (err instanceof HttpError) {
          this.send(res, err.status, fail(err.status, err.message, err.errors))
        } else {
          console.error('[mock-api]', err)
          this.send(res, 500, fail(500, 'Internal server error'))
        }
      }
      return
    }

    this.send(res, 404, fail(404, `Route not found: ${method} ${pathname}`))
  }

  authenticate(ctx) {
    const header = ctx.req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) throw new HttpError(401, 'Unauthenticated.')

    const session = ctx.db
      .prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?')
      .get(hashToken(token), new Date().toISOString())
    if (!session) throw new HttpError(401, 'Unauthenticated.')

    const user = ctx.db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(session.user_id)
    if (!user) throw new HttpError(401, 'Unauthenticated.')
    if (user.status !== 'active') {
      throw new HttpError(403, 'Your account is deactivated. Please contact the administrator.')
    }
    ctx.user = user
    ctx.token = token
  }

  authorize(ctx, permission) {
    const perms = new Set(this.userPermissions(ctx.user))
    const roles = this.userRoles(ctx.user)
    if (roles.includes('Super Admin') || perms.has(permission)) return
    throw new HttpError(403, `Missing permission: ${permission}`)
  }

  userRoles(user) {
    return (
      this.db
        .prepare(
          `SELECT r.name FROM roles r
           JOIN role_user ru ON ru.role_id = r.id
           WHERE ru.user_id = ?`,
        )
        .all(user.id)
        .map((r) => r.name) || []
    )
  }

  userPermissions(user) {
    return (
      this.db
        .prepare(
          `SELECT DISTINCT p.name FROM permissions p
           JOIN role_permission rp ON rp.permission_id = p.id
           JOIN role_user ru ON ru.role_id = rp.role_id
           WHERE ru.user_id = ?`,
        )
        .all(user.id)
        .map((p) => p.name) || []
    )
  }

  serializeUser(user) {
    const roles = this.db
      .prepare(
        `SELECT r.id, r.name FROM roles r
         JOIN role_user ru ON ru.role_id = r.id
         WHERE ru.user_id = ? ORDER BY r.id`,
      )
      .all(user.id)
      .map((r) => ({ ...r, permissions: this.userPermissions(user) }))
    // Authentication account only — employee/HR data lives in `employees`.
    const employee = this.db
      .prepare('SELECT id, employee_code FROM employees WHERE user_id = ? AND deleted_at IS NULL')
      .get(user.id)
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      department_id: user.department_id,
      employee_id: employee?.id ?? null,
      employee_code: employee?.employee_code ?? null,
      status: user.status,
      avatar: user.avatar,
      roles,
      permissions: this.userPermissions(user),
    }
  }

  send(res, status, payload) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
    })
    res.end(JSON.stringify(payload))
  }
}

export function createMockServer() {
  const router = new Router()

  // Request logging (dev aid)
  router.use((ctx) => {
    ctx.requestStartedAt = Date.now()
  })

  // Module route groups — one file per backend module
  registerRoutes(router)

  return createServer((req, res) => {
    if (!req.url.startsWith('/api')) {
      res.writeHead(404).end()
      return
    }
    router.handle(req, res)
  })
}

import { registerRoutes } from './routes/index.js'

export const issueToken = (db, userId) => {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  db.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(
    userId,
    hashToken(token),
    expiresAt,
  )
  return token
}

export { hashPassword }
