import { ok, HttpError } from '../server.js'
import { log } from './crud.helper.js'

/**
 * Module 8/9/10 — Assignments, transfers, asset requests.
 */

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export function assignmentRoutes(router) {
  router.get('/api/asset-assignments', (ctx) => {
    // Auto-mark overdue
    ctx.db.prepare(
      "UPDATE asset_assignments SET status = 'overdue', updated_at = ? WHERE status = 'active' AND expected_return_date IS NOT NULL AND expected_return_date < ?",
    ).run(new Date().toISOString(), new Date().toISOString().slice(0, 10))

    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    let where = '1=1'
    const params = []
    if (ctx.query.status) { where += ' AND a.status = ?'; params.push(ctx.query.status) }
    if (ctx.query.asset_id) { where += ' AND a.asset_id = ?'; params.push(Number(ctx.query.asset_id)) }
    if (ctx.query.assigned_to_user_id) { where += ' AND a.assigned_to_user_id = ?'; params.push(Number(ctx.query.assigned_to_user_id)) }
    if (ctx.query.search) {
      where += ' AND (asset.name LIKE ? OR asset.asset_code LIKE ? OR u.name LIKE ?)'
      params.push(`%${ctx.query.search}%`, `%${ctx.query.search}%`, `%${ctx.query.search}%`)
    }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM asset_assignments a LEFT JOIN assets asset ON asset.id = a.asset_id LEFT JOIN users u ON u.id = a.assigned_to_user_id WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT a.*, asset.name AS asset_name, asset.asset_code, asset.status AS asset_status,
              u.name AS assignee_name, u.username AS assignee_username
       FROM asset_assignments a
       LEFT JOIN assets asset ON asset.id = a.asset_id
       LEFT JOIN users u ON u.id = a.assigned_to_user_id
       WHERE ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)
    return ok('Assignments retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'assets.view' })

  router.get('/api/asset-assignments/:id', (ctx) => {
    const row = ctx.db.prepare('SELECT * FROM asset_assignments WHERE id = ?').get(Number(ctx.params.id))
    if (!row) throw new HttpError(404, 'Assignment not found.')
    return ok('Assignment retrieved successfully.', row)
  }, { auth: true, permission: 'assets.view' })

  // POST /api/assets/:assetId/assign
  router.post('/api/assets/:assetId/assign', (ctx) => {
    const asset = ctx.db.prepare('SELECT * FROM assets WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.assetId))
    if (!asset) throw new HttpError(404, 'Asset not found.')
    if (['disposed', 'retired'].includes(asset.status)) {
      throw new HttpError(422, 'Validation failed', { asset_id: ['This asset cannot be assigned (disposed/retired).'] })
    }
    const active = ctx.db.prepare("SELECT id FROM asset_assignments WHERE asset_id = ? AND status = 'active'").get(asset.id)
    if (active) throw new HttpError(422, 'Validation failed', { asset_id: ['This asset already has an active assignment.'] })

    const now = new Date().toISOString()
    const info = ctx.db.prepare(
      'INSERT INTO asset_assignments (asset_id, assigned_to_user_id, assigned_by, assigned_date, expected_return_date, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(asset.id, Number(ctx.body.assigned_to_user_id), ctx.user.id, now.slice(0, 10), ctx.body.expected_return_date || null, 'active', ctx.body.notes || null, now, now)
    ctx.db.prepare("UPDATE assets SET status = 'assigned', updated_at = ? WHERE id = ?").run(now, asset.id)
    log(ctx, 'assigned', 'Assignments', { id: Number(info.lastInsertRowid), name: asset.name })
    return ok('Asset assigned successfully.', ctx.db.prepare('SELECT * FROM asset_assignments WHERE id = ?').get(Number(info.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'assets.assign' })

  // POST /api/asset-assignments/:id/return
  router.post('/api/asset-assignments/:id/return', (ctx) => {
    const assignment = ctx.db.prepare('SELECT * FROM asset_assignments WHERE id = ?').get(Number(ctx.params.id))
    if (!assignment) throw new HttpError(404, 'Assignment not found.')
    if (assignment.status !== 'active') throw new HttpError(422, 'Validation failed', { assignment: ['This assignment is already closed.'] })

    const condition = ctx.body.condition_on_return
    const allowed = ['excellent', 'good', 'fair', 'poor', 'damaged']
    if (!allowed.includes(condition)) throw new HttpError(422, 'Validation failed', { condition_on_return: ['Invalid condition.'] })

    const now = new Date().toISOString()
    ctx.db.prepare("UPDATE asset_assignments SET status = 'returned', returned_date = ?, condition_on_return = ?, notes = ?, updated_at = ? WHERE id = ?")
      .run(ctx.body.returned_date || now.slice(0, 10), condition, ctx.body.notes || assignment.notes, now, assignment.id)
    ctx.db.prepare("UPDATE assets SET status = 'available', condition = ?, updated_at = ? WHERE id = ?")
      .run(condition, now, assignment.asset_id)
    log(ctx, 'returned', 'Assignments', { id: assignment.id, name: `asset#${assignment.asset_id}` })
    return ok('Asset returned successfully.', ctx.db.prepare('SELECT * FROM asset_assignments WHERE id = ?').get(assignment.id))
  }, { auth: true, permission: 'assets.return' })
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------
export function transferRoutes(router) {
  const TRANSITIONS = {
    draft: ['requested', 'rejected'],
    requested: ['approved', 'rejected'],
    approved: ['in_transit', 'rejected'],
    in_transit: ['completed', 'rejected'],
  }

  router.get('/api/transfers', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    let where = '1=1'
    const params = []
    if (ctx.query.status) { where += ' AND t.status = ?'; params.push(ctx.query.status) }
    if (ctx.query.search) { where += ' AND (asset.name LIKE ? OR asset.asset_code LIKE ?)'; params.push(`%${ctx.query.search}%`, `%${ctx.query.search}%`) }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM asset_transfers t LEFT JOIN assets asset ON asset.id = t.asset_id WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT t.*, asset.name AS asset_name, asset.asset_code,
              ru.name AS requester_name, au.name AS approver_name
       FROM asset_transfers t
       LEFT JOIN assets asset ON asset.id = t.asset_id
       LEFT JOIN users ru ON ru.id = t.requested_by
       LEFT JOIN users au ON au.id = t.approved_by
       WHERE ${where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)
    return ok('Transfers retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'assets.view' })

  router.post('/api/assets/:assetId/transfers', (ctx) => {
    const asset = ctx.db.prepare('SELECT * FROM assets WHERE id = ?').get(Number(ctx.params.assetId))
    if (!asset) throw new HttpError(404, 'Asset not found.')
    const now = new Date().toISOString()
    const info = ctx.db.prepare(
      `INSERT INTO asset_transfers (asset_id, from_campus_id, from_faculty_id, from_department_id, from_building_id, from_floor_id, from_room_id,
        to_campus_id, to_faculty_id, to_department_id, to_building_id, to_floor_id, to_room_id,
        requested_by, transfer_date, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(asset.id, ctx.body.from_campus_id ?? asset.campus_id, ctx.body.from_faculty_id ?? asset.faculty_id,
      ctx.body.from_department_id ?? asset.department_id, ctx.body.from_building_id ?? asset.building_id,
      ctx.body.from_floor_id ?? asset.floor_id, ctx.body.from_room_id ?? asset.room_id,
      ctx.body.to_campus_id || null, ctx.body.to_faculty_id || null, ctx.body.to_department_id || null,
      ctx.body.to_building_id || null, ctx.body.to_floor_id || null, ctx.body.to_room_id || null,
      ctx.user.id, ctx.body.transfer_date || null, 'requested', ctx.body.notes || null, now, now)
    log(ctx, 'transferred', 'Transfers', { id: Number(info.lastInsertRowid), name: asset.name })
    return ok('Transfer request created successfully.', ctx.db.prepare('SELECT * FROM asset_transfers WHERE id = ?').get(Number(info.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'assets.transfer' })

  router.patch('/api/transfers/:id/status', (ctx) => {
    const transfer = ctx.db.prepare('SELECT * FROM asset_transfers WHERE id = ?').get(Number(ctx.params.id))
    if (!transfer) throw new HttpError(404, 'Transfer not found.')
    const next = ctx.body.status
    const allowed = TRANSITIONS[transfer.status] || []
    if (!allowed.includes(next)) throw new HttpError(422, 'Validation failed', { status: [`Invalid transition from '${transfer.status}' to '${next}'.`] })

    const now = new Date().toISOString()
    ctx.db.prepare('UPDATE asset_transfers SET status = ?, updated_at = ? WHERE id = ?').run(next, now, transfer.id)
    if (next === 'approved') {
      ctx.db.prepare('UPDATE asset_transfers SET approved_by = ? WHERE id = ?').run(ctx.user.id, transfer.id)
    }
    if (next === 'completed') {
      ctx.db.prepare('UPDATE assets SET campus_id = ?, faculty_id = ?, department_id = ?, building_id = ?, floor_id = ?, room_id = ?, updated_at = ? WHERE id = ?')
        .run(transfer.to_campus_id, transfer.to_faculty_id, transfer.to_department_id,
          transfer.to_building_id, transfer.to_floor_id, transfer.to_room_id, now, transfer.asset_id)
      ctx.db.prepare(`INSERT INTO asset_location_histories (asset_id, campus_id, faculty_id, department_id, building_id, floor_id, room_id, moved_by, moved_at, reason, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(transfer.asset_id, transfer.to_campus_id, transfer.to_faculty_id, transfer.to_department_id,
          transfer.to_building_id, transfer.to_floor_id, transfer.to_room_id,
          ctx.user.id, now, 'Asset transfer completed', now)
    }
    log(ctx, next === 'rejected' ? 'rejected' : next === 'approved' ? 'approved' : 'transferred', 'Transfers', { id: transfer.id, name: `asset#${transfer.asset_id}` })
    return ok('Transfer status updated successfully.', ctx.db.prepare('SELECT * FROM asset_transfers WHERE id = ?').get(transfer.id))
  }, { auth: true, permission: 'assets.transfer' })
}

// ---------------------------------------------------------------------------
// Asset requests
// ---------------------------------------------------------------------------
export function assetRequestRoutes(router) {
  router.get('/api/asset-requests', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    let where = '1=1'
    const params = []
    if (ctx.query.status) { where += ' AND r.status = ?'; params.push(ctx.query.status) }
    if (ctx.query.request_type) { where += ' AND r.request_type = ?'; params.push(ctx.query.request_type) }
    if (ctx.query.search) { where += ' AND (r.request_number LIKE ? OR u.name LIKE ?)'; params.push(`%${ctx.query.search}%`, `%${ctx.query.search}%`) }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM asset_requests r LEFT JOIN users u ON u.id = r.requester_id WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT r.*, u.name AS requester_name, d.name AS department_name, c.name AS category_name
       FROM asset_requests r
       LEFT JOIN users u ON u.id = r.requester_id
       LEFT JOIN departments d ON d.id = r.department_id
       LEFT JOIN asset_categories c ON c.id = r.asset_category_id
       WHERE ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)
    return ok('Asset requests retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'requests.view' })

  router.post('/api/asset-requests', (ctx) => {
    const now = new Date().toISOString()
    const count = ctx.db.prepare('SELECT COUNT(*) AS c FROM asset_requests').get().c
    const info = ctx.db.prepare(
      `INSERT INTO asset_requests (request_number, requester_id, department_id, request_type, asset_category_id, quantity, reason, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(`ARQ-${now.slice(0, 4)}-${String(count + 1).padStart(4, '0')}`, ctx.user.id,
      ctx.body.department_id || null, ctx.body.request_type || 'new_asset',
      ctx.body.asset_category_id || null, ctx.body.quantity || 1, ctx.body.reason || null, 'draft', now, now)
    log(ctx, 'created', 'Requests', { id: Number(info.lastInsertRowid), name: `ARQ-${now.slice(0, 4)}-${String(count + 1).padStart(4, '0')}` })
    return ok('Asset request created successfully.', ctx.db.prepare('SELECT * FROM asset_requests WHERE id = ?').get(Number(info.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'requests.create' })

  router.post('/api/asset-requests/:id/submit', (ctx) => {
    const row = ctx.db.prepare("SELECT * FROM asset_requests WHERE id = ? AND status = 'draft'").get(Number(ctx.params.id))
    if (!row) throw new HttpError(422, 'Validation failed', { status: ['Only draft requests can be submitted.'] })
    ctx.db.prepare("UPDATE asset_requests SET status = 'department_approval', updated_at = ? WHERE id = ?").run(new Date().toISOString(), row.id)
    log(ctx, 'submitted', 'Requests', row)
    return ok('Asset request submitted successfully.', ctx.db.prepare('SELECT * FROM asset_requests WHERE id = ?').get(row.id))
  }, { auth: true, permission: 'requests.create' })

  router.post('/api/asset-requests/:id/department-approve', (ctx) => {
    const row = ctx.db.prepare("SELECT * FROM asset_requests WHERE id = ? AND status = 'department_approval'").get(Number(ctx.params.id))
    if (!row) throw new HttpError(422, 'Validation failed', { status: ['Request is not awaiting department approval.'] })
    const approve = ctx.body?.approve !== false
    ctx.db.prepare('UPDATE asset_requests SET status = ?, updated_at = ? WHERE id = ?').run(approve ? 'manager_review' : 'rejected', new Date().toISOString(), row.id)
    log(ctx, approve ? 'approved' : 'rejected', 'Requests', row)
    return ok('Asset request updated successfully.', ctx.db.prepare('SELECT * FROM asset_requests WHERE id = ?').get(row.id))
  }, { auth: true, permission: 'requests.approve' })

  router.post('/api/asset-requests/:id/manager-approve', (ctx) => {
    const row = ctx.db.prepare("SELECT * FROM asset_requests WHERE id = ? AND status IN ('manager_review', 'department_approval')").get(Number(ctx.params.id))
    if (!row) throw new HttpError(422, 'Validation failed', { status: ['Request is not awaiting asset manager review.'] })
    const approve = ctx.body?.approve !== false
    ctx.db.prepare('UPDATE asset_requests SET status = ?, updated_at = ? WHERE id = ?').run(approve ? 'approved' : 'rejected', new Date().toISOString(), row.id)
    log(ctx, approve ? 'approved' : 'rejected', 'Requests', row)
    return ok('Asset request updated successfully.', ctx.db.prepare('SELECT * FROM asset_requests WHERE id = ?').get(row.id))
  }, { auth: true, permission: 'requests.approve' })

  router.post('/api/asset-requests/:id/complete', (ctx) => {
    const row = ctx.db.prepare("SELECT * FROM asset_requests WHERE id = ? AND status = 'approved'").get(Number(ctx.params.id))
    if (!row) throw new HttpError(422, 'Validation failed', { status: ['Only approved requests can be completed.'] })
    ctx.db.prepare("UPDATE asset_requests SET status = 'completed', updated_at = ? WHERE id = ?").run(new Date().toISOString(), row.id)
    log(ctx, 'completed', 'Requests', row)
    return ok('Asset request completed successfully.', ctx.db.prepare('SELECT * FROM asset_requests WHERE id = ?').get(row.id))
  }, { auth: true, permission: 'requests.approve' })
}
