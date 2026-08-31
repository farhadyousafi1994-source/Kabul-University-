import { ok } from '../server.js'

/**
 * Module 24 — Activity logs (paginated).
 */
export function activityRoutes(router) {
  router.get('/api/activity-logs', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    const search = (ctx.query.search || '').toLowerCase()

    let where = '1=1'
    const params = []
    if (ctx.query.module) {
      where += ' AND al.module = ?'
      params.push(ctx.query.module)
    }
    if (ctx.query.action) {
      where += ' AND al.action = ?'
      params.push(ctx.query.action)
    }
    if (search) {
      where += ' AND (al.entity_label LIKE ? OR u.name LIKE ? OR al.module LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const total = ctx.db
      .prepare(`SELECT COUNT(*) AS c FROM activity_logs al LEFT JOIN users u ON u.id = al.user_id WHERE ${where}`)
      .get(...params).c

    const rows = ctx.db
      .prepare(
        `SELECT al.*, u.name AS user_name FROM activity_logs al
         LEFT JOIN users u ON u.id = al.user_id
         WHERE ${where} ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, perPage, (page - 1) * perPage)

    return ok('Activity logs retrieved successfully.', {
      data: rows,
      meta: {
        current_page: page,
        last_page: Math.max(1, Math.ceil(total / perPage)),
        per_page: perPage,
        total,
      },
    })
  }, { auth: true, permission: 'audit.view' })
}
