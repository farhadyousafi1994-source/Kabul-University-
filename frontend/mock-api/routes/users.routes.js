import { ok } from '../server.js'

/**
 * Module 2 — Users (list endpoint for Phase 1; full CRUD lands in Phase 3).
 */
export function userRoutes(router) {
  router.get('/api/users', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    const search = (ctx.query.search || '').toLowerCase()

    let where = 'u.deleted_at IS NULL'
    const params = []
    if (ctx.query.status) {
      where += ' AND u.status = ?'
      params.push(ctx.query.status)
    }
    if (ctx.query.department_id) {
      where += ' AND u.department_id = ?'
      params.push(Number(ctx.query.department_id))
    }
    if (search) {
      where += ' AND (u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.employee_number LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }

    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM users u WHERE ${where}`).get(...params).c

    const rows = ctx.db
      .prepare(`SELECT u.* FROM users u WHERE ${where} ORDER BY u.name ASC LIMIT ? OFFSET ?`)
      .all(...params, perPage, (page - 1) * perPage)
      .map((u) => router.serializeUser(u))

    return ok('Users retrieved successfully.', {
      data: rows,
      meta: {
        current_page: page,
        last_page: Math.max(1, Math.ceil(total / perPage)),
        per_page: perPage,
        total,
      },
    })
  }, { auth: true, permission: 'users.view' })
}
