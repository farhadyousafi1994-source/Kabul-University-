import { ok, HttpError } from '../server.js'
import { log } from './crud.helper.js'

/**
 * Module 14 — Audits, Module 16 — Procurement.
 * Mirrors backend/routes/api/system.php audit + procurement groups exactly.
 */
export function auditRoutes(router) {
  router.get('/api/audits', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    let where = '1=1'
    const params = []
    if (ctx.query.status) { where += ' AND a.status = ?'; params.push(ctx.query.status) }
    if (ctx.query.search) { where += ' AND (a.audit_code LIKE ? OR a.scope_type LIKE ?)'; params.push(`%${ctx.query.search}%`, `%${ctx.query.search}%`) }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM asset_audits a WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT a.*, u.name AS auditor_name
       FROM asset_audits a LEFT JOIN users u ON u.id = a.auditor_id
       WHERE ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)
    return ok('Audits retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'audit.view' })

  router.post('/api/audits', (ctx) => {
    const now = new Date().toISOString()
    const count = ctx.db.prepare('SELECT COUNT(*) AS c FROM asset_audits').get().c
    const code = `AUD-${now.slice(0, 4)}-${String(count + 1).padStart(4, '0')}`
    const info = ctx.db.prepare(
      'INSERT INTO asset_audits (audit_code, auditor_id, scope_type, scope_id, scheduled_at, status, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(code, ctx.user.id, ctx.body.scope_type || 'all', ctx.body.scope_id || null,
      ctx.body.scheduled_at || null, 'draft', null, now, now)
    log(ctx, 'created', 'Audits', { id: Number(info.lastInsertRowid), name: code })
    return ok('Audit created successfully.', ctx.db.prepare('SELECT * FROM asset_audits WHERE id = ?').get(Number(info.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'audit.create' })

  router.get('/api/audits/:id', (ctx) => {
    const audit = ctx.db.prepare('SELECT * FROM asset_audits WHERE id = ?').get(Number(ctx.params.id))
    if (!audit) throw new HttpError(404, 'Audit not found.')
    audit.items = ctx.db.prepare(
      `SELECT ai.*, asset.name AS asset_name, asset.asset_code, asset.status AS asset_status
       FROM asset_audit_items ai LEFT JOIN assets asset ON asset.id = ai.asset_id
       WHERE ai.asset_audit_id = ? ORDER BY asset.asset_code`,
    ).all(audit.id)
    return ok('Audit retrieved successfully.', audit)
  }, { auth: true, permission: 'audit.view' })

  // Snapshot every non-disposed asset as audit items and mark the audit in_progress.
  router.post('/api/audits/:id/start', (ctx) => {
    const audit = ctx.db.prepare("SELECT * FROM asset_audits WHERE id = ? AND status IN ('draft', 'scheduled')").get(Number(ctx.params.id))
    if (!audit) throw new HttpError(422, 'Validation failed', { status: ['Only draft/scheduled audits can be started.'] })
    const now = new Date().toISOString()
    const existing = ctx.db.prepare('SELECT COUNT(*) AS c FROM asset_audit_items WHERE asset_audit_id = ?').get(audit.id).c
    if (existing === 0) {
      const assets = ctx.db.prepare("SELECT id FROM assets WHERE deleted_at IS NULL AND status != 'disposed'").all()
      const ins = ctx.db.prepare('INSERT INTO asset_audit_items (asset_audit_id, asset_id, verification, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      for (const a of assets) ins.run(audit.id, a.id, 'pending', null, now, now)
    }
    ctx.db.prepare("UPDATE asset_audits SET status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?").run(now, now, audit.id)
    log(ctx, 'started', 'Audits', audit)
    return ok('Audit started successfully.', ctx.db.prepare('SELECT * FROM asset_audits WHERE id = ?').get(audit.id))
  }, { auth: true, permission: 'audit.create' })

  // Verify a single audit item (by asset id within this audit).
  router.post('/api/audits/:id/verify', (ctx) => {
    const audit = ctx.db.prepare("SELECT * FROM asset_audits WHERE id = ? AND status = 'in_progress'").get(Number(ctx.params.id))
    if (!audit) throw new HttpError(422, 'Validation failed', { status: ['Only in-progress audits can verify items.'] })
    const assetId = Number(ctx.body.asset_id)
    const verification = ctx.body.verification
    const allowed = ['pending', 'found', 'missing', 'damaged']
    if (!allowed.includes(verification)) throw new HttpError(422, 'Validation failed', { verification: ['Invalid verification value.'] })
    const asset = ctx.db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId)
    if (!asset) throw new HttpError(404, 'Asset not found.')
    const now = new Date().toISOString()

    const existing = ctx.db.prepare('SELECT * FROM asset_audit_items WHERE asset_audit_id = ? AND asset_id = ?').get(audit.id, assetId)
    if (existing) {
      ctx.db.prepare('UPDATE asset_audit_items SET verification = ?, notes = ?, scanned_at = ?, updated_at = ? WHERE id = ?')
        .run(verification, ctx.body.notes ?? existing.notes, now, now, existing.id)
    } else {
      ctx.db.prepare('INSERT INTO asset_audit_items (asset_audit_id, asset_id, verification, notes, scanned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(audit.id, assetId, verification, ctx.body.notes || null, now, now, now)
    }
    log(ctx, 'verified', 'Audits', audit)
    return ok('Audit item verified successfully.', ctx.db.prepare('SELECT * FROM asset_audit_items WHERE asset_audit_id = ? AND asset_id = ?').get(audit.id, assetId))
  }, { auth: true, permission: 'audit.complete' })

  router.post('/api/audits/:id/complete', (ctx) => {
    const audit = ctx.db.prepare("SELECT * FROM asset_audits WHERE id = ? AND status = 'in_progress'").get(Number(ctx.params.id))
    if (!audit) throw new HttpError(422, 'Validation failed', { status: ['Only in-progress audits can be completed.'] })
    const stats = ctx.db.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN verification = 'found' THEN 1 ELSE 0 END) AS found,
              SUM(CASE WHEN verification = 'missing' THEN 1 ELSE 0 END) AS missing,
              SUM(CASE WHEN verification = 'damaged' THEN 1 ELSE 0 END) AS damaged
       FROM asset_audit_items WHERE asset_audit_id = ?`,
    ).get(audit.id)
    const now = new Date().toISOString()
    ctx.db.prepare('UPDATE asset_audits SET status = ?, completed_at = ?, summary = ?, updated_at = ? WHERE id = ?')
      .run('completed', now, JSON.stringify({ total: stats.total || 0, found: stats.found || 0, missing: stats.missing || 0, damaged: stats.damaged || 0 }), now, audit.id)
    log(ctx, 'completed', 'Audits', audit)
    return ok('Audit completed successfully.', ctx.db.prepare('SELECT * FROM asset_audits WHERE id = ?').get(audit.id))
  }, { auth: true, permission: 'audit.complete' })

  router.post('/api/audits/:id/cancel', (ctx) => {
    const audit = ctx.db.prepare("SELECT * FROM asset_audits WHERE id = ? AND status IN ('draft', 'scheduled', 'in_progress')").get(Number(ctx.params.id))
    if (!audit) throw new HttpError(422, 'Validation failed', { status: ['This audit cannot be cancelled.'] })
    ctx.db.prepare("UPDATE asset_audits SET status = 'cancelled', updated_at = ? WHERE id = ?").run(new Date().toISOString(), audit.id)
    log(ctx, 'cancelled', 'Audits', audit)
    return ok('Audit cancelled successfully.', ctx.db.prepare('SELECT * FROM asset_audits WHERE id = ?').get(audit.id))
  }, { auth: true, permission: 'audit.create' })
}

export function procurementRoutes(router) {
  const PR_STATUSES = ['draft', 'requested', 'approved', 'rejected', 'cancelled']
  const PO_STATUSES = ['draft', 'sent', 'partially_received', 'received', 'cancelled']

  // ---------------- Purchase requests ----------------
  router.get('/api/purchase-requests', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    let where = '1=1'
    const params = []
    if (ctx.query.status) { where += ' AND pr.status = ?'; params.push(ctx.query.status) }
    if (ctx.query.search) { where += ' AND pr.pr_number LIKE ?'; params.push(`%${ctx.query.search}%`) }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM purchase_requests pr WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT pr.*, s.name AS supplier_name, u.name AS requested_by_name
       FROM purchase_requests pr
       LEFT JOIN suppliers s ON s.id = pr.supplier_id
       LEFT JOIN users u ON u.id = pr.requested_by
       WHERE ${where} ORDER BY pr.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)
    return ok('Purchase requests retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'procurement.view' })

  router.post('/api/purchase-requests', (ctx) => {
    const now = new Date().toISOString()
    const count = ctx.db.prepare('SELECT COUNT(*) AS c FROM purchase_requests').get().c
    const pr = `PR-${now.slice(0, 4)}-${String(count + 1).padStart(4, '0')}`
    const info = ctx.db.prepare(
      'INSERT INTO purchase_requests (pr_number, requested_by, department_id, supplier_id, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(pr, ctx.user.id, ctx.body.department_id || null, ctx.body.supplier_id || null, 'draft', ctx.body.notes || null, now, now)
    log(ctx, 'created', 'Procurement', { id: Number(info.lastInsertRowid), name: pr })
    return ok('Purchase request created successfully.', ctx.db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(Number(info.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'procurement.create' })

  // Approving a PR converts it into a purchase order.
  router.post('/api/purchase-requests/:id/approve', (ctx) => {
    const row = ctx.db.prepare("SELECT * FROM purchase_requests WHERE id = ? AND status IN ('draft', 'requested')").get(Number(ctx.params.id))
    if (!row) throw new HttpError(422, 'Validation failed', { status: ['Only draft/requested purchase requests can be approved.'] })
    const supplierId = row.supplier_id ?? ctx.body.supplier_id ?? null
    if (!supplierId) {
      throw new HttpError(422, 'Validation failed', { supplier_id: ['A supplier is required before approving a purchase request.'] })
    }
    const now = new Date().toISOString()
    ctx.db.prepare("UPDATE purchase_requests SET status = 'approved', updated_at = ? WHERE id = ?").run(now, row.id)

    let po = ctx.db.prepare('SELECT * FROM purchase_orders WHERE purchase_request_id = ?').get(row.id)
    if (!po) {
      const poCount = ctx.db.prepare('SELECT COUNT(*) AS c FROM purchase_orders').get().c
      const poNumber = `PO-${now.slice(0, 4)}-${String(poCount + 1).padStart(4, '0')}`
      const ins = ctx.db.prepare(
        'INSERT INTO purchase_orders (po_number, purchase_request_id, supplier_id, status, order_date, expected_date, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(poNumber, row.id, supplierId, 'draft', now.slice(0, 10), ctx.body.expected_date ?? null, ctx.user.id, now, now)
      po = ctx.db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(Number(ins.lastInsertRowid))
    }
    if (Array.isArray(ctx.body.items)) {
      const ins = ctx.db.prepare(
        'INSERT INTO purchase_order_items (purchase_order_id, asset_category_id, name, brand, model, quantity, unit_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      for (const it of ctx.body.items) {
        ins.run(po.id, it.asset_category_id || null, it.name, it.brand || null, it.model || null, it.quantity || 1, it.unit_price || 0, now, now)
      }
    }
    log(ctx, 'approved', 'Procurement', row)
    return ok('Purchase request approved and purchase order created.', po)
  }, { auth: true, permission: 'procurement.approve' })

  // ---------------- Purchase orders ----------------
  router.get('/api/purchase-orders', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    let where = '1=1'
    const params = []
    if (ctx.query.status) { where += ' AND po.status = ?'; params.push(ctx.query.status) }
    if (ctx.query.search) { where += ' AND po.po_number LIKE ?'; params.push(`%${ctx.query.search}%`) }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM purchase_orders po WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT po.*, s.name AS supplier_name, u.name AS created_by_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN users u ON u.id = po.created_by
       WHERE ${where} ORDER BY po.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)
    return ok('Purchase orders retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'procurement.view' })

  router.post('/api/purchase-orders', (ctx) => {
    const now = new Date().toISOString()
    const count = ctx.db.prepare('SELECT COUNT(*) AS c FROM purchase_orders').get().c
    const poNumber = `PO-${now.slice(0, 4)}-${String(count + 1).padStart(4, '0')}`
    const info = ctx.db.prepare(
      'INSERT INTO purchase_orders (po_number, purchase_request_id, supplier_id, status, order_date, expected_date, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(poNumber, ctx.body.purchase_request_id || null, Number(ctx.body.supplier_id), 'draft',
      now.slice(0, 10), ctx.body.expected_date || null, ctx.user.id, now, now)
    if (Array.isArray(ctx.body.items)) {
      const ins = ctx.db.prepare(
        'INSERT INTO purchase_order_items (purchase_order_id, asset_category_id, name, brand, model, quantity, unit_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      for (const it of ctx.body.items) {
        ins.run(Number(info.lastInsertRowid), it.asset_category_id || null, it.name, it.brand || null, it.model || null, it.quantity || 1, it.unit_price || 0, now, now)
      }
    }
    log(ctx, 'created', 'Procurement', { id: Number(info.lastInsertRowid), name: poNumber })
    return ok('Purchase order created successfully.', ctx.db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(Number(info.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'procurement.create' })

  router.get('/api/purchase-orders/:id', (ctx) => {
    const po = ctx.db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(Number(ctx.params.id))
    if (!po) throw new HttpError(404, 'Purchase order not found.')
    po.items = ctx.db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').all(po.id)
    po.receipts = ctx.db.prepare('SELECT * FROM purchase_receipts WHERE purchase_order_id = ?').all(po.id)
    return ok('Purchase order retrieved successfully.', po)
  }, { auth: true, permission: 'procurement.view' })

  router.post('/api/purchase-orders/:id/send', (ctx) => {
    const po = ctx.db.prepare("SELECT * FROM purchase_orders WHERE id = ? AND status = 'draft'").get(Number(ctx.params.id))
    if (!po) throw new HttpError(422, 'Validation failed', { status: ['Only draft purchase orders can be sent.'] })
    ctx.db.prepare("UPDATE purchase_orders SET status = 'sent', updated_at = ? WHERE id = ?").run(new Date().toISOString(), po.id)
    log(ctx, 'sent', 'Procurement', po)
    return ok('Purchase order sent to supplier.', ctx.db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(po.id))
  }, { auth: true, permission: 'procurement.update' })

  // Receive goods: record receipt, mark items received, create asset records.
  router.post('/api/purchase-orders/:id/receive', (ctx) => {
    const po = ctx.db.prepare("SELECT * FROM purchase_orders WHERE id = ? AND status IN ('sent', 'partially_received')").get(Number(ctx.params.id))
    if (!po) throw new HttpError(422, 'Validation failed', { status: ['Only sent/partially-received purchase orders can receive goods.'] })
    const now = new Date().toISOString()

    const receivCount = ctx.db.prepare('SELECT COUNT(*) AS c FROM purchase_receipts').get().c
    const receiptNumber = `RCP-${now.slice(0, 4)}-${String(receivCount + 1).padStart(4, '0')}`
    ctx.db.prepare(
      'INSERT INTO purchase_receipts (receipt_number, purchase_order_id, warehouse_id, received_by, received_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(receiptNumber, po.id, ctx.body.warehouse_id || null, ctx.user.id, now.slice(0, 10), ctx.body.notes || null, now, now)

    const items = ctx.db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?').all(po.id)
    const cat = ctx.db.prepare('SELECT * FROM asset_categories ORDER BY id LIMIT 1').get()
    const prefix = (cat?.code || 'GEN').replace(/^CAT-/, '')
    const year = new Date().getFullYear()
    for (const item of items) {
      const last = ctx.db.prepare('SELECT asset_code FROM assets WHERE asset_code LIKE ? ORDER BY asset_code DESC LIMIT 1').get(`KU-${prefix}-${year}-%`)
      const num = last ? Number(last.asset_code.split('-').pop()) + 1 : 1
      const code = `KU-${prefix}-${year}-${String(num).padStart(6, '0')}`
      const ins = ctx.db.prepare(
        `INSERT INTO assets (asset_code, name, category_id, purchase_date, purchase_price, current_value, status, condition, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(code, item.name, item.asset_category_id || cat?.id, now.slice(0, 10),
        item.unit_price || 0, item.unit_price || 0, 'available', 'good', ctx.user.id, now, now)
      ctx.db.prepare('INSERT INTO asset_location_histories (asset_id, moved_by, moved_at, reason, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(Number(ins.lastInsertRowid), ctx.user.id, now, 'Received from procurement', now)
      ctx.db.prepare('UPDATE purchase_order_items SET received_quantity = ? WHERE id = ?').run(item.quantity, item.id)
    }
    ctx.db.prepare("UPDATE purchase_orders SET status = 'received', updated_at = ? WHERE id = ?").run(now, po.id)
    log(ctx, 'received', 'Procurement', po)
    return ok('Purchase order received successfully.', ctx.db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(po.id))
  }, { auth: true, permission: 'procurement.update' })
}
