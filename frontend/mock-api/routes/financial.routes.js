import { ok, HttpError } from '../server.js'
import { log } from './crud.helper.js'

/**
 * Module 18 — Depreciation, Module 19 — Disposal.
 * Mirrors backend/routes/api/system.php financial groups exactly.
 */
export function depreciationRoutes(router) {
  router.get('/api/depreciation-methods', (ctx) => {
    const rows = ctx.db.prepare('SELECT * FROM depreciation_methods ORDER BY id').all()
    return ok('Depreciation methods retrieved successfully.', { data: rows })
  }, { auth: true, permission: 'depreciation.view' })

  router.get('/api/depreciations', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    let where = '1=1'
    const params = []
    if (ctx.query.asset_id) { where += ' AND d.asset_id = ?'; params.push(Number(ctx.query.asset_id)) }
    if (ctx.query.period) { where += ' AND d.period = ?'; params.push(ctx.query.period) }
    if (ctx.query.search) { where += ' AND (asset.name LIKE ? OR asset.asset_code LIKE ?)'; params.push(`%${ctx.query.search}%`, `%${ctx.query.search}%`) }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM asset_depreciations d LEFT JOIN assets asset ON asset.id = d.asset_id WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT d.*, asset.name AS asset_name, asset.asset_code, m.name AS method_name
       FROM asset_depreciations d
       LEFT JOIN assets asset ON asset.id = d.asset_id
       LEFT JOIN depreciation_methods m ON m.id = d.method_id
       WHERE ${where} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)
    return ok('Depreciation records retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'depreciation.view' })

  // Compute the current period for one asset (or all) using straight-line.
  router.post('/api/depreciations/calculate', (ctx) => {
    const method = ctx.db.prepare('SELECT * FROM depreciation_methods WHERE id = ?').get(Number(ctx.body.method_id || 1))
    if (!method) throw new HttpError(422, 'Validation failed', { method_id: ['Invalid depreciation method.'] })
    const period = ctx.body.period || new Date().toISOString().slice(0, 7) // YYYY-MM
    const now = new Date().toISOString()

    const assets = ctx.body.asset_id
      ? [ctx.db.prepare('SELECT * FROM assets WHERE id = ?').get(Number(ctx.body.asset_id))].filter(Boolean)
      : ctx.db.prepare("SELECT * FROM assets WHERE deleted_at IS NULL AND status != 'disposed' AND useful_life > 0").all()

    const records = []
    const insert = ctx.db.prepare(
      `INSERT OR REPLACE INTO asset_depreciations (asset_id, method_id, period, original_value, salvage_value, useful_life, annual_depreciation, accumulated_depreciation, book_value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const asset of assets) {
      const original = Number(asset.purchase_price) || 0
      const salvage = Number(asset.salvage_value) || 0
      const usefulLife = Number(asset.useful_life) || 5
      if (original <= 0) continue

      const annual = (original - salvage) / usefulLife
      const prev = ctx.db.prepare('SELECT * FROM asset_depreciations WHERE asset_id = ? AND period < ? ORDER BY period DESC LIMIT 1').get(asset.id, period)
      let accumulated = 0
      if (prev) {
        accumulated = prev.accumulated_depreciation
        const [y, m] = period.split('-').map(Number)
        const [py, pm] = prev.period.split('-').map(Number)
        accumulated += annual * ((y - py) * 12 + (m - pm)) / 12
      } else {
        const purchaseDate = asset.purchase_date || asset.created_at || ''
        const monthsSincePurchase = purchaseDate
          ? Math.max(0, Math.floor((Date.now() - Date.parse(purchaseDate)) / (30.44 * 24 * 3600 * 1000)))
          : 0
        accumulated = annual * monthsSincePurchase / 12
      }
      accumulated = Math.min(Math.max(accumulated, 0), original - salvage)
      const bookValue = Math.max(salvage, original - accumulated)

      insert.run(asset.id, method.id, period, original, salvage, usefulLife,
        Number(annual.toFixed(2)), Number(accumulated.toFixed(2)), Number(bookValue.toFixed(2)), now, now)
      records.push(ctx.db.prepare('SELECT * FROM asset_depreciations WHERE asset_id = ? AND period = ?').get(asset.id, period))
    }
    log(ctx, 'calculated', 'Depreciation', { id: null, name: `period ${period} (${records.length} assets)` })
    return ok('Depreciation calculated successfully.', { data: records, method: method.name, period })
  }, { auth: true, permission: 'depreciation.calculate' })

  // Current book value for one asset.
  router.get('/api/assets/:id/book-value', (ctx) => {
    const asset = ctx.db.prepare('SELECT * FROM assets WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.id))
    if (!asset) throw new HttpError(404, 'Asset not found.')
    const latest = ctx.db.prepare('SELECT * FROM asset_depreciations WHERE asset_id = ? ORDER BY period DESC LIMIT 1').get(asset.id)
    return ok('Book value retrieved successfully.', {
      asset_id: asset.id,
      asset_code: asset.asset_code,
      name: asset.name,
      purchase_price: Number(asset.purchase_price) || 0,
      salvage_value: Number(asset.salvage_value) || 0,
      useful_life: asset.useful_life,
      current_value: Number(asset.current_value) || 0,
      accumulated_depreciation: latest?.accumulated_depreciation || 0,
      book_value: latest?.book_value ?? (Number(asset.current_value) || 0),
      last_period: latest?.period || null,
    })
  }, { auth: true, permission: 'depreciation.view' })

  // Monthly schedule runner (same math as /calculate, wrapped for cron parity).
  router.post('/api/depreciations/run-monthly', (ctx) => {
    const now = new Date().toISOString()
    const lastMonth = new Date()
    lastMonth.setUTCDate(1)
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1)
    const period = lastMonth.toISOString().slice(0, 7)
    const assets = ctx.db.prepare("SELECT id FROM assets WHERE deleted_at IS NULL AND status != 'disposed' AND useful_life > 0 AND purchase_price > 0").all()
    const insert = ctx.db.prepare(
      `INSERT OR REPLACE INTO asset_depreciations (asset_id, method_id, period, original_value, salvage_value, useful_life, annual_depreciation, accumulated_depreciation, book_value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    let count = 0
    for (const { id } of assets) {
      const asset = ctx.db.prepare('SELECT * FROM assets WHERE id = ?').get(id)
      const original = Number(asset.purchase_price) || 0
      const salvage = Number(asset.salvage_value) || 0
      const usefulLife = Number(asset.useful_life) || 5
      const annual = (original - salvage) / usefulLife
      const prev = ctx.db.prepare('SELECT * FROM asset_depreciations WHERE asset_id = ? AND period < ? ORDER BY period DESC LIMIT 1').get(id, period)
      let accumulated = prev ? prev.accumulated_depreciation : 0
      if (prev) {
        const [y, m] = period.split('-').map(Number)
        const [py, pm] = prev.period.split('-').map(Number)
        accumulated += annual * ((y - py) * 12 + (m - pm)) / 12
      } else {
        const purchaseDate = asset.purchase_date || asset.created_at || ''
        const months = purchaseDate ? Math.max(0, Math.floor((Date.now() - Date.parse(purchaseDate)) / (30.44 * 24 * 3600 * 1000))) : 0
        accumulated = annual * months / 12
      }
      accumulated = Math.min(Math.max(accumulated, 0), original - salvage)
      insert.run(id, 1, period, original, salvage, usefulLife, Number(annual.toFixed(2)),
        Number(accumulated.toFixed(2)), Number(Math.max(salvage, original - accumulated).toFixed(2)), now, now)
      count++
    }
    log(ctx, 'calculated', 'Depreciation', { id: null, name: `monthly run ${period} (${count} assets)` })
    return ok('Monthly depreciation run completed.', { period, assets_processed: count })
  }, { auth: true, permission: 'depreciation.calculate' })
}

export function disposalRoutes(router) {
  const STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'completed']

  // GET /api/disposals (permission: assets.view per backend route).
  router.get('/api/disposals', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    let where = '1=1'
    const params = []
    if (ctx.query.status) { where += ' AND d.status = ?'; params.push(ctx.query.status) }
    if (ctx.query.method) { where += ' AND d.method = ?'; params.push(ctx.query.method) }
    if (ctx.query.search) { where += ' AND (asset.name LIKE ? OR asset.asset_code LIKE ?)'; params.push(`%${ctx.query.search}%`, `%${ctx.query.search}%`) }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM asset_disposals d LEFT JOIN assets asset ON asset.id = d.asset_id WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT d.*, asset.name AS asset_name, asset.asset_code, asset.status AS asset_status,
              req.name AS requested_by_name, app.name AS approved_by_name
       FROM asset_disposals d
       LEFT JOIN assets asset ON asset.id = d.asset_id
       LEFT JOIN users req ON req.id = d.requested_by
       LEFT JOIN users app ON app.id = d.approved_by
       WHERE ${where} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)
    return ok('Disposals retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'assets.view' })

  // POST /api/disposals
  router.post('/api/disposals', (ctx) => {
    const asset = ctx.db.prepare('SELECT * FROM assets WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.body.asset_id))
    if (!asset) throw new HttpError(404, 'Asset not found.')
    if (['disposed', 'retired'].includes(asset.status)) {
      throw new HttpError(422, 'Validation failed', { asset_id: ['This asset is already disposed/retired.'] })
    }
    const now = new Date().toISOString()
    const info = ctx.db.prepare(
      `INSERT INTO asset_disposals (asset_id, method, requested_by, request_date, status, revenue, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(asset.id, ctx.body.method || 'sold', ctx.user.id, now.slice(0, 10), 'pending_approval',
      ctx.body.revenue || 0, ctx.body.notes || null, now, now)
    log(ctx, 'created', 'Disposals', { id: Number(info.lastInsertRowid), name: asset.name })
    return ok('Disposal request created successfully.', ctx.db.prepare('SELECT * FROM asset_disposals WHERE id = ?').get(Number(info.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'assets.dispose' })

  // POST /api/disposals/:id/inspect — record inspection notes (stays pending).
  router.post('/api/disposals/:id/inspect', (ctx) => {
    const disposal = ctx.db.prepare("SELECT * FROM asset_disposals WHERE id = ? AND status = 'pending_approval'").get(Number(ctx.params.id))
    if (!disposal) throw new HttpError(422, 'Validation failed', { status: ['Only pending approvals can be inspected.'] })
    const now = new Date().toISOString()
    ctx.db.prepare('UPDATE asset_disposals SET notes = ?, updated_at = ? WHERE id = ?')
      .run(ctx.body.notes ?? disposal.notes, now, disposal.id)
    log(ctx, 'inspected', 'Disposals', disposal)
    return ok('Disposal inspection recorded.', ctx.db.prepare('SELECT * FROM asset_disposals WHERE id = ?').get(disposal.id))
  }, { auth: true, permission: 'assets.dispose' })

  // POST /api/disposals/:id/approve
  router.post('/api/disposals/:id/approve', (ctx) => {
    const disposal = ctx.db.prepare("SELECT * FROM asset_disposals WHERE id = ? AND status = 'pending_approval'").get(Number(ctx.params.id))
    if (!disposal) throw new HttpError(422, 'Validation failed', { status: ['Only pending approvals can be approved.'] })
    const approve = ctx.body?.approve !== false
    const now = new Date().toISOString()
    const sets = { status: approve ? 'approved' : 'rejected', updated_at: now }
    if (approve) { sets.approved_by = ctx.user.id; sets.approval_date = now.slice(0, 10) }
    const keys = Object.keys(sets)
    ctx.db.prepare(`UPDATE asset_disposals SET ${keys.map((k) => `"${k}" = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => sets[k]), disposal.id)
    log(ctx, approve ? 'approved' : 'rejected', 'Disposals', disposal)
    return ok('Disposal updated successfully.', ctx.db.prepare('SELECT * FROM asset_disposals WHERE id = ?').get(disposal.id))
  }, { auth: true, permission: 'assets.dispose' })

  // POST /api/disposals/:id/execute — the disposed asset is NEVER hard-deleted:
  // its status becomes 'disposed' and the record remains for audit.
  router.post('/api/disposals/:id/execute', (ctx) => {
    const disposal = ctx.db.prepare("SELECT * FROM asset_disposals WHERE id = ? AND status = 'approved'").get(Number(ctx.params.id))
    if (!disposal) throw new HttpError(422, 'Validation failed', { status: ['Only approved disposals can be executed.'] })
    const now = new Date().toISOString()
    ctx.db.prepare("UPDATE asset_disposals SET status = 'completed', disposal_date = ?, updated_at = ? WHERE id = ?")
      .run(ctx.body.disposal_date || now.slice(0, 10), now, disposal.id)
    ctx.db.prepare('UPDATE assets SET status = ?, current_value = ?, updated_at = ? WHERE id = ?')
      .run('disposed', ctx.body.revenue ?? disposal.revenue ?? 0, now, disposal.asset_id)
    log(ctx, 'disposed', 'Disposals', disposal)
    return ok('Disposal executed successfully.', ctx.db.prepare('SELECT * FROM asset_disposals WHERE id = ?').get(disposal.id))
  }, { auth: true, permission: 'assets.dispose' })
}
