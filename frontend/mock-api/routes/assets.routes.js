import { ok, HttpError } from '../server.js'
import { log } from './crud.helper.js'

/**
 * Module 6/7 — Assets, images & documents.
 */
export function assetRoutes(router) {
  const ASSET_COLS = ['name', 'description', 'category_id', 'subcategory_id', 'brand', 'model',
    'serial_number', 'barcode', 'qr_code', 'purchase_date', 'purchase_price', 'current_value',
    'salvage_value', 'supplier_id', 'warranty_expiry_date', 'useful_life', 'status', 'condition',
    'campus_id', 'faculty_id', 'department_id', 'building_id', 'floor_id', 'room_id', 'employee_id']

  // Validates an incoming `employee_id` (assignment target must exist).
  const checkEmployee = (ctx, employeeId) => {
    if (employeeId === undefined || employeeId === null || employeeId === '') return
    const emp = ctx.db.prepare('SELECT id FROM employees WHERE id = ? AND deleted_at IS NULL').get(Number(employeeId))
    if (!emp) throw new HttpError(422, 'Validation failed', { employee_id: ['The selected employee does not exist.'] })
  }

  const coerceEmployeeId = (value) => {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    return Number(value)
  }

  /**
   * Keep assignment rows in step with assets.employee_id.
   * Closing an active row does NOT flip the asset to `available` (that would
   * clobber `under_maintenance`). Do not early-return when both current and
   * target are null if an active assignment still exists.
   */
  const syncAssignmentRows = (ctx, assetId, targetEmployeeId) => {
    const now = new Date().toISOString()
    const target = coerceEmployeeId(targetEmployeeId) ?? null
    const actives = ctx.db.prepare(
      "SELECT * FROM asset_assignments WHERE asset_id = ? AND status = 'active' ORDER BY id DESC",
    ).all(assetId)
    const active = actives[0] || null
    const activeEmp = active?.employee_id != null ? Number(active.employee_id) : null
    if (target === activeEmp && actives.length <= 1 && (target !== null || !active)) return

    if (actives.length) {
      ctx.db.prepare(
        "UPDATE asset_assignments SET status = 'returned', returned_date = ?, updated_at = ? WHERE asset_id = ? AND status = 'active'",
      ).run(now.slice(0, 10), now, assetId)
    }

    if (target == null) return
    const employee = ctx.db.prepare('SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL').get(target)
    if (!employee) return
    ctx.db.prepare(
      'INSERT INTO asset_assignments (asset_id, employee_id, assigned_to_user_id, assigned_by, assigned_date, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(assetId, employee.id, employee.user_id || null, ctx.user.id, now.slice(0, 10), 'active', null, now, now)
  }

  // GET /api/assets
  router.get('/api/assets', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    const search = (ctx.query.search || '').toLowerCase()

    let where = 'a.deleted_at IS NULL'
    const params = []
    for (const col of ['status', 'condition']) {
      if (ctx.query[col]) { where += ` AND a.${col} = ?`; params.push(ctx.query[col]) }
    }
    for (const col of ['category_id', 'campus_id', 'faculty_id', 'department_id', 'building_id', 'floor_id', 'room_id', 'supplier_id', 'employee_id']) {
      if (ctx.query[col]) { where += ` AND a.${col} = ?`; params.push(Number(ctx.query[col])) }
    }
    if (ctx.query.code) {
      where += ' AND (a.asset_code = ? OR a.barcode = ? OR a.qr_code = ?)'
      params.push(ctx.query.code, ctx.query.code, ctx.query.code)
    }
    if (search) {
      where += ` AND (a.asset_code LIKE ? OR a.name LIKE ? OR a.serial_number LIKE ? OR a.brand LIKE ? OR a.model LIKE ?)`
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }

    const sortMap = { name: 'a.name', asset_code: 'a.asset_code', purchase_date: 'a.purchase_date', purchase_price: 'a.purchase_price', status: 'a.status', created_at: 'a.created_at' }
    const sort = sortMap[ctx.query.sort] || 'a.created_at'
    const dir = (ctx.query.direction || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM assets a WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT a.*, c.name AS category_name, s.name AS supplier_name,
              cm.name AS campus_name, f.name AS faculty_name, d.name AS department_name,
              b.name AS building_name, fl.name AS floor_name, r.name AS room_name,
              TRIM(e.first_name || ' ' || e.last_name) AS employee_name,
              e.employee_code AS employee_code,
              (SELECT COUNT(*) FROM asset_images i WHERE i.asset_id = a.id) AS images_count,
              (SELECT COUNT(*) FROM asset_documents doc WHERE doc.asset_id = a.id) AS documents_count
       FROM assets a
       LEFT JOIN asset_categories c ON c.id = a.category_id
       LEFT JOIN suppliers s ON s.id = a.supplier_id
       LEFT JOIN campuses cm ON cm.id = a.campus_id
       LEFT JOIN faculties f ON f.id = a.faculty_id
       LEFT JOIN departments d ON d.id = a.department_id
       LEFT JOIN buildings b ON b.id = a.building_id
       LEFT JOIN floors fl ON fl.id = a.floor_id
       LEFT JOIN rooms r ON r.id = a.room_id
       LEFT JOIN employees e ON e.id = a.employee_id
       WHERE ${where} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)

    return ok('Assets retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'assets.view' })

  // GET /api/assets/lookup?code=
  router.get('/api/assets/lookup', (ctx) => {
    const code = (ctx.query.code || '').trim()
    if (!code) throw new HttpError(422, 'A code is required.', { code: ['The code field is required.'] })
    const asset = ctx.db.prepare(
      'SELECT * FROM assets WHERE (asset_code = ? OR barcode = ? OR qr_code = ?) AND deleted_at IS NULL',
    ).get(code, code, code)
    if (!asset) throw new HttpError(404, 'No asset found for this code.')
    return ok('Asset found.', asset)
  }, { auth: true, permission: 'assets.view' })

  // GET /api/assets/:id/timeline
  router.get('/api/assets/:id/timeline', (ctx) => {
    const assetId = Number(ctx.params.id)
    const asset = ctx.db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId)
    if (!asset) throw new HttpError(404, 'Asset not found.')

    const timeline = []
    for (const h of ctx.db.prepare('SELECT * FROM asset_location_histories WHERE asset_id = ?').all(assetId)) {
      timeline.push({ date: h.moved_at, type: 'location', title: 'Location change', description: `${h.reason || 'Moved'} — moved by user #${h.moved_by || 'system'}` })
    }
    for (const a of ctx.db.prepare(
      `SELECT a.*, TRIM(e.first_name || ' ' || e.last_name) AS employee_name
       FROM asset_assignments a LEFT JOIN employees e ON e.id = a.employee_id
       WHERE a.asset_id = ?`).all(assetId)) {
      timeline.push({
        date: a.assigned_date,
        type: 'assignment',
        title: `Assignment ${a.status}`,
        description: `Assigned to ${a.employee_name || 'Unassigned'}`,
      })
    }
    for (const m of ctx.db.prepare('SELECT * FROM asset_maintenances WHERE asset_id = ?').all(assetId)) {
      timeline.push({ date: m.end_date || m.start_date || m.created_at, type: 'maintenance', title: `Maintenance ${m.status}`, description: `${m.maintenance_type} — cost ${m.cost}` })
    }
    for (const t of ctx.db.prepare('SELECT * FROM asset_transfers WHERE asset_id = ?').all(assetId)) {
      timeline.push({ date: t.created_at, type: 'transfer', title: `Transfer ${t.status}`, description: t.notes || 'Asset transfer' })
    }
    timeline.sort((x, y) => (y.date || '').localeCompare(x.date || ''))
    return ok('Asset timeline retrieved successfully.', timeline)
  }, { auth: true, permission: 'assets.view' })

  // POST /api/assets
  router.post('/api/assets', (ctx) => {
    const now = new Date().toISOString()
    const picked = {}
    for (const k of ASSET_COLS) if (ctx.body[k] !== undefined) picked[k] = ctx.body[k]
    const data = { ...picked, created_by: ctx.user.id, created_at: now, updated_at: now }

    if (!data.name || !data.category_id) {
      throw new HttpError(422, 'Validation failed', {
        name: data.name ? [] : ['The name field is required.'],
        category_id: data.category_id ? [] : ['The category field is required.'],
      })
    }
    if (data.employee_id === '') data.employee_id = null
    checkEmployee(ctx, data.employee_id)

    // Asset code generation: KU-{CAT}-{YEAR}-{NNNNNN}
    const cat = ctx.db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(Number(data.category_id))
    const prefix = (cat?.code || 'GEN').replace(/^CAT-/, '')
    const year = new Date().getFullYear()
    const last = ctx.db.prepare("SELECT asset_code FROM assets WHERE asset_code LIKE ? ORDER BY asset_code DESC LIMIT 1")
      .get(`KU-${prefix}-${year}-%`)
    const num = last ? Number(last.asset_code.split('-').pop()) + 1 : 1
    data.asset_code = `KU-${prefix}-${year}-${String(num).padStart(6, '0')}`
    if (!data.barcode) data.barcode = String(6270000000000 + Math.floor(Math.random() * 999999999))
    if (!data.qr_code) data.qr_code = `KUQR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    if (!data.status) data.status = 'available'
    if (!data.condition) data.condition = 'good'
    if (!data.useful_life) data.useful_life = 5
    if (data.purchase_price && !data.current_value) data.current_value = data.purchase_price
    // Creating an asset already in an employee's hands ⇒ status is assigned.
    if (data.employee_id && data.status === 'available') data.status = 'assigned'

    const keys = Object.keys(data)
    const stmt = ctx.db.prepare(`INSERT INTO assets (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
    const info = stmt.run(...keys.map((k) => data[k]))
    const id = Number(info.lastInsertRowid)

    // Initial location history
    ctx.db.prepare(`INSERT INTO asset_location_histories (asset_id, campus_id, faculty_id, department_id, building_id, floor_id, room_id, moved_by, moved_at, reason, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.campus_id || null, data.faculty_id || null, data.department_id || null,
        data.building_id || null, data.floor_id || null, data.room_id || null,
        ctx.user.id, now, 'Initial registration', now)

    if (data.employee_id) syncAssignmentRows(ctx, id, data.employee_id)

    log(ctx, 'created', 'Assets', { id, name: data.name })
    return ok('Asset created successfully.', ctx.db.prepare(
      `SELECT a.*, TRIM(e.first_name || ' ' || e.last_name) AS employee_name, e.employee_code AS employee_code
       FROM assets a LEFT JOIN employees e ON e.id = a.employee_id WHERE a.id = ?`).get(id), null, 201)
  }, { auth: true, permission: 'assets.create' })

  // GET /api/assets/:id
  router.get('/api/assets/:id', (ctx) => {
    const asset = ctx.db.prepare(
      `SELECT a.*, TRIM(e.first_name || ' ' || e.last_name) AS employee_name, e.employee_code AS employee_code
       FROM assets a
       LEFT JOIN employees e ON e.id = a.employee_id
       WHERE a.id = ? AND a.deleted_at IS NULL`,
    ).get(Number(ctx.params.id))
    if (!asset) throw new HttpError(404, 'Asset not found.')
    return ok('Asset retrieved successfully.', asset)
  }, { auth: true, permission: 'assets.view' })

  // PUT /api/assets/:id
  router.put('/api/assets/:id', (ctx) => {
    const asset = ctx.db.prepare('SELECT * FROM assets WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.id))
    if (!asset) throw new HttpError(404, 'Asset not found.')

    const picked = {}
    for (const k of ASSET_COLS) if (ctx.body[k] !== undefined) picked[k] = ctx.body[k]
    const data = { ...picked, updated_at: new Date().toISOString() }
    if (data.employee_id === '') data.employee_id = null
    checkEmployee(ctx, data.employee_id)

    // Keep the status in step with the employee assignment when the caller
    // did not set an explicit status themselves.
    const employeeChanged = data.employee_id !== undefined
      && Number(data.employee_id || 0) !== Number(asset.employee_id || 0)
    if (employeeChanged && data.status === undefined) {
      if (data.employee_id) {
        if (asset.status === 'available' || asset.status === 'assigned' || asset.status === 'reserved') data.status = 'assigned'
      } else if (asset.status === 'assigned') {
        data.status = 'available'
      }
    }

    const locCols = ['campus_id', 'faculty_id', 'department_id', 'building_id', 'floor_id', 'room_id']
    const locChanged = locCols.some((c) => data[c] !== undefined && Number(data[c] || 0) !== Number(asset[c] || 0))

    const keys = Object.keys(data)
    ctx.db.prepare(`UPDATE assets SET ${keys.map((k) => `"${k}" = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map((k) => data[k]), asset.id)

    if (locChanged) {
      ctx.db.prepare(`INSERT INTO asset_location_histories (asset_id, campus_id, faculty_id, department_id, building_id, floor_id, room_id, moved_by, moved_at, reason, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(asset.id, data.campus_id ?? asset.campus_id, data.faculty_id ?? asset.faculty_id,
          data.department_id ?? asset.department_id, data.building_id ?? asset.building_id,
          data.floor_id ?? asset.floor_id, data.room_id ?? asset.room_id,
          ctx.user.id, new Date().toISOString(), 'Location updated', new Date().toISOString())
    }

    if (data.employee_id !== undefined) syncAssignmentRows(ctx, asset.id, data.employee_id)

    log(ctx, 'updated', 'Assets', { id: asset.id, name: data.name || asset.name })
    if (employeeChanged) {
      log(ctx, data.employee_id ? 'assigned' : 'unassigned', 'Assets', { id: asset.id, name: asset.name })
    }
    return ok('Asset updated successfully.', ctx.db.prepare(
      `SELECT a.*, TRIM(e.first_name || ' ' || e.last_name) AS employee_name, e.employee_code AS employee_code
       FROM assets a LEFT JOIN employees e ON e.id = a.employee_id WHERE a.id = ?`).get(asset.id))
  }, { auth: true, permission: 'assets.update' })

  // DELETE /api/assets/:id
  router.delete('/api/assets/:id', (ctx) => {
    const asset = ctx.db.prepare('SELECT * FROM assets WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.id))
    if (!asset) throw new HttpError(404, 'Asset not found.')
    ctx.db.prepare('UPDATE assets SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), new Date().toISOString(), asset.id)
    log(ctx, 'deleted', 'Assets', asset)
    return ok('Asset archived successfully.')
  }, { auth: true, permission: 'assets.delete' })

  // PATCH /api/assets/:id/status
  router.patch('/api/assets/:id/status', (ctx) => {
    const asset = ctx.db.prepare('SELECT * FROM assets WHERE id = ?').get(Number(ctx.params.id))
    if (!asset) throw new HttpError(404, 'Asset not found.')
    const status = ctx.body?.status
    const allowed = ['available', 'assigned', 'reserved', 'under_maintenance', 'damaged', 'lost', 'stolen', 'disposed', 'retired']
    if (!allowed.includes(status)) throw new HttpError(422, 'Validation failed', { status: ['Invalid status.'] })
    ctx.db.prepare('UPDATE assets SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), asset.id)
    log(ctx, 'updated', 'Assets', { id: asset.id, name: asset.name })
    return ok('Asset status updated successfully.', ctx.db.prepare('SELECT * FROM assets WHERE id = ?').get(asset.id))
  }, { auth: true, permission: 'assets.update' })

  // Images & documents
  router.get('/api/assets/:id/images', (ctx) => {
    return ok('Images retrieved successfully.', { data: ctx.db.prepare('SELECT * FROM asset_images WHERE asset_id = ?').all(Number(ctx.params.id)) })
  }, { auth: true, permission: 'assets.view' })
  router.get('/api/assets/:id/documents', (ctx) => {
    return ok('Documents retrieved successfully.', { data: ctx.db.prepare('SELECT * FROM asset_documents WHERE asset_id = ?').all(Number(ctx.params.id)) })
  }, { auth: true, permission: 'assets.view' })

  router.post('/api/assets/:id/images', (ctx) => {
    const assetId = Number(ctx.params.id)
    const file = ctx.body?.file || {}
    const row = ctx.db.prepare(
      'INSERT INTO asset_images (asset_id, filename, path, mime, size, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(assetId, file.filename || 'upload.jpg', file.path || `/mock-uploads/${assetId}-${Date.now()}.jpg`, file.mime || 'image/jpeg', file.size || 0, ctx.user.id, new Date().toISOString(), new Date().toISOString())
    return ok('Image uploaded successfully.', ctx.db.prepare('SELECT * FROM asset_images WHERE id = ?').get(Number(row.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'assets.update' })

  router.post('/api/assets/:id/documents', (ctx) => {
    const assetId = Number(ctx.params.id)
    const file = ctx.body?.file || {}
    const row = ctx.db.prepare(
      'INSERT INTO asset_documents (asset_id, kind, filename, path, mime, size, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(assetId, ctx.body?.kind || 'other', file.filename || 'upload.pdf', file.path || `/mock-uploads/${assetId}-${Date.now()}.pdf`, file.mime || 'application/pdf', file.size || 0, ctx.user.id, new Date().toISOString(), new Date().toISOString())
    return ok('Document uploaded successfully.', ctx.db.prepare('SELECT * FROM asset_documents WHERE id = ?').get(Number(row.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'assets.update' })

  router.delete('/api/asset-images/:id', (ctx) => {
    ctx.db.prepare('DELETE FROM asset_images WHERE id = ?').run(Number(ctx.params.id))
    return ok('Image deleted successfully.')
  }, { auth: true, permission: 'assets.update' })
  router.delete('/api/asset-documents/:id', (ctx) => {
    ctx.db.prepare('DELETE FROM asset_documents WHERE id = ?').run(Number(ctx.params.id))
    return ok('Document deleted successfully.')
  }, { auth: true, permission: 'assets.update' })
}
