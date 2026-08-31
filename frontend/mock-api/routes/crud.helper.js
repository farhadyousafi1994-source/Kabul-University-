import { ok, HttpError } from '../server.js'

/**
 * Generic CRUD route registration for a mock entity.
 * Mirrors the pattern used by the backend's thin CRUD controllers.
 */
export function registerCrud(router, { base, table, searchable = [], sortable = 'created_at', perms, logModule }) {
  // GET /base
  router.get(`/api/${base}`, (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    const search = (ctx.query.search || '').toLowerCase()

    let where = 'deleted_at IS NULL'
    const params = []
    if (ctx.query.status) { where += ' AND status = ?'; params.push(ctx.query.status) }

    for (const col of ['campus_id', 'faculty_id', 'department_id', 'building_id', 'floor_id', 'room_id', 'category_id']) {
      if (ctx.query[col]) { where += ` AND ${col} = ?`; params.push(Number(ctx.query[col])) }
    }

    if (search && searchable.length) {
      where += ' AND (' + searchable.map((c) => `${c} LIKE ?`).join(' OR ') + ')'
      searchable.forEach(() => params.push(`%${search}%`))
    }

    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE ${where}`).get(...params).c
    const rows = ctx.db
      .prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY ${sortable} DESC LIMIT ? OFFSET ?`)
      .all(...params, perPage, (page - 1) * perPage)

    return ok('List retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: `${perms}.view` })

  // POST /base
  router.post(`/api/${base}`, (ctx) => {
    const now = new Date().toISOString()
    const cols = ['code', 'name', 'description', 'status']
    const data = { ...ctx.body }
    data.created_at = now
    data.updated_at = now
    if (data.status === undefined) data.status = 'active'
    const keys = Object.keys(data)
    const stmt = ctx.db.prepare(
      `INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    )
    const info = stmt.run(...keys.map((k) => data[k]))
    const row = ctx.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(info.lastInsertRowid))
    log(ctx, 'created', logModule, row)
    return ok('Created successfully.', row, null, 201)
  }, { auth: true, permission: `${perms}.create` })

  // GET /base/:id
  router.get(`/api/${base}/:id`, (ctx) => {
    const row = ctx.db.prepare(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(Number(ctx.params.id))
    if (!row) throw new HttpError(404, 'Resource not found.')
    return ok('Retrieved successfully.', row)
  }, { auth: true, permission: `${perms}.view` })

  // PUT /base/:id
  router.put(`/api/${base}/:id`, (ctx) => {
    const row = ctx.db.prepare(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(Number(ctx.params.id))
    if (!row) throw new HttpError(404, 'Resource not found.')
    const data = { ...ctx.body, updated_at: new Date().toISOString() }
    const keys = Object.keys(data)
    ctx.db.prepare(`UPDATE ${table} SET ${keys.map((k) => `"${k}" = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map((k) => data[k]), row.id)
    log(ctx, 'updated', logModule, { ...row, ...data })
    return ok('Updated successfully.', ctx.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(row.id))
  }, { auth: true, permission: `${perms}.update` })

  // DELETE /base/:id
  router.delete(`/api/${base}/:id`, (ctx) => {
    const row = ctx.db.prepare(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(Number(ctx.params.id))
    if (!row) throw new HttpError(404, 'Resource not found.')
    ctx.db.prepare(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), new Date().toISOString(), row.id)
    log(ctx, 'deleted', logModule, row)
    return ok('Archived successfully.')
  }, { auth: true, permission: `${perms}.delete` })
}

export function log(ctx, action, module, entity) {
  ctx.db.prepare(
    'INSERT INTO activity_logs (user_id, action, module, entity_type, entity_id, entity_label, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(ctx.user.id, action, module, entity?.constructor?.name || entity?.entity_type || null, entity?.id ?? null, entity?.name ?? entity?.code ?? null, ctx.req.socket?.remoteAddress || '127.0.0.1', new Date().toISOString())
}
