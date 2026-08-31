import { ok, HttpError } from '../server.js'

/**
 * Module 23 — Notifications (in-app).
 */
export function notificationRoutes(router) {
  // GET /api/notifications
  router.get('/api/notifications', (ctx) => {
    const rows = ctx.db
      .prepare(
        `SELECT id, type, data_json, read_at, created_at FROM notifications
         WHERE notifiable_id = ? ORDER BY created_at DESC LIMIT 50`,
      )
      .all(ctx.user.id)
      .map((n) => ({ ...JSON.parse(n.data_json), id: n.id, read_at: n.read_at, created_at: n.created_at }))

    return ok('Notifications retrieved successfully.', { data: rows })
  }, { auth: true })

  // POST /api/notifications/{id}/read
  router.post('/api/notifications/:id/read', (ctx) => {
    const n = ctx.db
      .prepare('SELECT * FROM notifications WHERE id = ? AND notifiable_id = ?')
      .get(Number(ctx.params.id), ctx.user.id)
    if (!n) throw new HttpError(404, 'Notification not found.')

    ctx.db
      .prepare('UPDATE notifications SET read_at = ? WHERE id = ?')
      .run(new Date().toISOString(), n.id)
    return ok('Notification marked as read.')
  }, { auth: true })

  // POST /api/notifications/read-all
  router.post('/api/notifications/read-all', (ctx) => {
    ctx.db
      .prepare('UPDATE notifications SET read_at = ? WHERE notifiable_id = ? AND read_at IS NULL')
      .run(new Date().toISOString(), ctx.user.id)
    return ok('All notifications marked as read.')
  }, { auth: true })
}
