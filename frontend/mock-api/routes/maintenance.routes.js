import { ok, HttpError } from '../server.js'
import { log } from './crud.helper.js'

/**
 * Module 11/12 — Maintenance requests, work orders, incidents.
 */
export function maintenanceRoutes(router) {
  const WO_TRANSITIONS = {
    requested: ['approved', 'cancelled'],
    approved: ['assigned', 'in_progress', 'cancelled'],
    assigned: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
  }

  // ---------------- Maintenance requests ----------------
  router.get('/api/maintenance-requests', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    let where = '1=1'
    const params = []
    if (ctx.query.status) { where += ' AND mr.status = ?'; params.push(ctx.query.status) }
    if (ctx.query.maintenance_type) { where += ' AND mr.maintenance_type = ?'; params.push(ctx.query.maintenance_type) }
    if (ctx.query.search) { where += ' AND (asset.name LIKE ? OR asset.asset_code LIKE ?)'; params.push(`%${ctx.query.search}%`, `%${ctx.query.search}%`) }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM maintenance_requests mr LEFT JOIN assets asset ON asset.id = mr.asset_id WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT mr.*, asset.name AS asset_name, asset.asset_code, u.name AS requester_name
       FROM maintenance_requests mr
       LEFT JOIN assets asset ON asset.id = mr.asset_id
       LEFT JOIN users u ON u.id = mr.requested_by
       WHERE ${where} ORDER BY mr.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)
    return ok('Maintenance requests retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'maintenance.view' })

  router.post('/api/maintenance-requests', (ctx) => {
    const now = new Date().toISOString()
    const info = ctx.db.prepare(
      'INSERT INTO maintenance_requests (asset_id, requested_by, maintenance_type, priority, problem, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(Number(ctx.body.asset_id), ctx.user.id, ctx.body.maintenance_type || 'corrective',
      ctx.body.priority || 'medium', ctx.body.problem, 'requested', now, now)
    log(ctx, 'created', 'Maintenance', { id: Number(info.lastInsertRowid), name: `asset#${ctx.body.asset_id}` })
    return ok('Maintenance request created successfully.', ctx.db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(Number(info.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'maintenance.create' })

  router.post('/api/maintenance-requests/:id/approve', (ctx) => {
    const row = ctx.db.prepare("SELECT * FROM maintenance_requests WHERE id = ? AND status = 'requested'").get(Number(ctx.params.id))
    if (!row) throw new HttpError(422, 'Validation failed', { status: ['Only requested maintenance can be approved.'] })
    ctx.db.prepare("UPDATE maintenance_requests SET status = 'approved', updated_at = ? WHERE id = ?").run(new Date().toISOString(), row.id)
    log(ctx, 'approved', 'Maintenance', row)
    return ok('Maintenance request approved successfully.', ctx.db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(row.id))
  }, { auth: true, permission: 'maintenance.update' })

  // ---------------- Work orders ----------------
  router.get('/api/maintenances', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    let where = '1=1'
    const params = []
    if (ctx.query.status) { where += ' AND am.status = ?'; params.push(ctx.query.status) }
    if (ctx.query.maintenance_type) { where += ' AND am.maintenance_type = ?'; params.push(ctx.query.maintenance_type) }
    if (ctx.query.asset_id) { where += ' AND am.asset_id = ?'; params.push(Number(ctx.query.asset_id)) }
    if (ctx.query.search) { where += ' AND (asset.name LIKE ? OR asset.asset_code LIKE ?)'; params.push(`%${ctx.query.search}%`, `%${ctx.query.search}%`) }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM asset_maintenances am LEFT JOIN assets asset ON asset.id = am.asset_id WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT am.*, asset.name AS asset_name, asset.asset_code, asset.status AS asset_status,
              tech.name AS technician_name
       FROM asset_maintenances am
       LEFT JOIN assets asset ON asset.id = am.asset_id
       LEFT JOIN users tech ON tech.id = am.technician_id
       WHERE ${where} ORDER BY am.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)
    return ok('Maintenance records retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'maintenance.view' })

  router.post('/api/maintenances', (ctx) => {
    const now = new Date().toISOString()
    const info = ctx.db.prepare(
      `INSERT INTO asset_maintenances (maintenance_request_id, asset_id, technician_id, maintenance_type, scheduled_date, start_date, cost, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(ctx.body.maintenance_request_id || null, Number(ctx.body.asset_id),
      ctx.body.technician_id || null, ctx.body.maintenance_type || 'corrective',
      ctx.body.scheduled_date || null, ctx.body.start_date || null,
      ctx.body.cost || 0, ctx.body.notes || null, 'approved', now, now)
    ctx.db.prepare("UPDATE assets SET status = 'under_maintenance', updated_at = ? WHERE id = ?").run(now, Number(ctx.body.asset_id))
    log(ctx, 'created', 'Maintenance', { id: Number(info.lastInsertRowid), name: `asset#${ctx.body.asset_id}` })
    return ok('Work order created successfully.', ctx.db.prepare('SELECT * FROM asset_maintenances WHERE id = ?').get(Number(info.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'maintenance.create' })

  router.patch('/api/maintenances/:id/status', (ctx) => {
    const wo = ctx.db.prepare('SELECT * FROM asset_maintenances WHERE id = ?').get(Number(ctx.params.id))
    if (!wo) throw new HttpError(404, 'Maintenance record not found.')
    const next = ctx.body.status
    const allowed = WO_TRANSITIONS[wo.status] || []
    if (!allowed.includes(next)) throw new HttpError(422, 'Validation failed', { status: [`Invalid transition from '${wo.status}' to '${next}'.`] })

    const now = new Date().toISOString()
    const sets = { status: next, updated_at: now }
    if (next === 'assigned' && ctx.body.technician_id) sets.technician_id = ctx.body.technician_id
    if (next === 'in_progress') sets.start_date = ctx.body.start_date || now.slice(0, 10)
    if (next === 'completed') {
      sets.end_date = ctx.body.end_date || now.slice(0, 10)
      sets.result = ctx.body.result || 'Completed successfully'
      if (ctx.body.cost !== undefined) sets.cost = ctx.body.cost
      ctx.db.prepare("UPDATE assets SET status = 'available', updated_at = ? WHERE id = ?").run(now, wo.asset_id)
    }
    const keys = Object.keys(sets)
    ctx.db.prepare(`UPDATE asset_maintenances SET ${keys.map((k) => `"${k}" = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map((k) => sets[k]), wo.id)
    log(ctx, next === 'completed' ? 'maintained' : 'updated', 'Maintenance', wo)
    return ok('Maintenance status updated successfully.', ctx.db.prepare('SELECT * FROM asset_maintenances WHERE id = ?').get(wo.id))
  }, { auth: true, permission: 'maintenance.update' })

  // ---------------- Incidents ----------------
  router.get('/api/incidents', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    let where = '1=1'
    const params = []
    if (ctx.query.status) { where += ' AND i.status = ?'; params.push(ctx.query.status) }
    if (ctx.query.incident_type) { where += ' AND i.incident_type = ?'; params.push(ctx.query.incident_type) }
    if (ctx.query.search) { where += ' AND (asset.name LIKE ? OR asset.asset_code LIKE ?)'; params.push(`%${ctx.query.search}%`, `%${ctx.query.search}%`) }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM asset_incidents i LEFT JOIN assets asset ON asset.id = i.asset_id WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT i.*, asset.name AS asset_name, asset.asset_code, u.name AS reporter_name
       FROM asset_incidents i
       LEFT JOIN assets asset ON asset.id = i.asset_id
       LEFT JOIN users u ON u.id = i.reported_by
       WHERE ${where} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)
    return ok('Incidents retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'incidents.view' })

  router.post('/api/incidents', (ctx) => {
    const now = new Date().toISOString()
    const info = ctx.db.prepare(
      'INSERT INTO asset_incidents (asset_id, incident_type, description, incident_date, reported_by, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(Number(ctx.body.asset_id), ctx.body.incident_type, ctx.body.description,
      ctx.body.incident_date || now.slice(0, 10), ctx.user.id, 'open', now, now)
    const statusMap = { lost: 'lost', stolen: 'stolen', destroyed: 'disposed', damaged: 'damaged' }
    ctx.db.prepare('UPDATE assets SET status = ?, updated_at = ? WHERE id = ?').run(statusMap[ctx.body.incident_type] || 'damaged', now, Number(ctx.body.asset_id))
    log(ctx, 'incident', 'Incidents', { id: Number(info.lastInsertRowid), name: `asset#${ctx.body.asset_id}` })
    return ok('Incident reported successfully.', ctx.db.prepare('SELECT * FROM asset_incidents WHERE id = ?').get(Number(info.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'incidents.create' })

  router.patch('/api/incidents/:id/status', (ctx) => {
    const incident = ctx.db.prepare('SELECT * FROM asset_incidents WHERE id = ?').get(Number(ctx.params.id))
    if (!incident) throw new HttpError(404, 'Incident not found.')
    const allowed = ['open', 'investigating', 'resolved', 'closed']
    if (!allowed.includes(ctx.body.status)) throw new HttpError(422, 'Validation failed', { status: ['Invalid status.'] })
    ctx.db.prepare('UPDATE asset_incidents SET status = ?, resolution = ?, updated_at = ? WHERE id = ?')
      .run(ctx.body.status, ctx.body.resolution ?? incident.resolution, new Date().toISOString(), incident.id)
    if (['resolved', 'closed'].includes(ctx.body.status) && incident.incident_type === 'damaged') {
      ctx.db.prepare("UPDATE assets SET status = 'available', updated_at = ? WHERE id = ?").run(new Date().toISOString(), incident.asset_id)
    }
    log(ctx, 'updated', 'Incidents', incident)
    return ok('Incident updated successfully.', ctx.db.prepare('SELECT * FROM asset_incidents WHERE id = ?').get(incident.id))
  }, { auth: true, permission: 'incidents.update' })
}
