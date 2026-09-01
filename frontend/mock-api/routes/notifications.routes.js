import { ok, HttpError } from '../server.js'

/**
 * Module 23 — Notifications (in-app).
 *
 *   GET    /api/notifications           -> history (optional ?read=unread)
 *   POST   /api/notifications/:id/read  -> mark one as read
 *   POST   /api/notifications/read-all  -> mark every notification as read
 *   DELETE /api/notifications/:id       -> forget one
 *   DELETE /api/notifications           -> forget every read notification
 */
export function notificationRoutes(router) {
  // GET /api/notifications?read=unread
  router.get('/api/notifications', (ctx) => {
    const where = ctx.query.read === 'unread' ? 'AND read_at IS NULL' : ''
    const rows = ctx.db
      .prepare(
        `SELECT id, type, data_json, read_at, created_at FROM notifications
         WHERE notifiable_id = ? ${where} ORDER BY created_at DESC LIMIT 200`,
      )
      .all(ctx.user.id)
      .map((n) => ({ ...JSON.parse(n.data_json), id: n.id, type: n.type, read_at: n.read_at, created_at: n.created_at }))

    const unread = ctx.db
      .prepare('SELECT COUNT(*) AS c FROM notifications WHERE notifiable_id = ? AND read_at IS NULL')
      .get(ctx.user.id).c

    return ok('Notifications retrieved successfully.', { data: rows }, { unread })
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

  // DELETE /api/notifications/{id}
  router.delete('/api/notifications/:id', (ctx) => {
    const n = ctx.db
      .prepare('SELECT * FROM notifications WHERE id = ? AND notifiable_id = ?')
      .get(Number(ctx.params.id), ctx.user.id)
    if (!n) throw new HttpError(404, 'Notification not found.')

    ctx.db.prepare('DELETE FROM notifications WHERE id = ?').run(n.id)
    return ok('Notification deleted.')
  }, { auth: true })

  // DELETE /api/notifications — clear everything that is already read
  router.delete('/api/notifications', (ctx) => {
    const info = ctx.db
      .prepare('DELETE FROM notifications WHERE notifiable_id = ? AND read_at IS NOT NULL')
      .run(ctx.user.id)
    return ok('Read notifications cleared.', { deleted: info.changes })
  }, { auth: true })
}
