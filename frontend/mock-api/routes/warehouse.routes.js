import { ok, HttpError } from '../server.js'
import { registerCrud, log } from './crud.helper.js'

/**
 * Module 17 — Warehouses & stock transactions.
 */
export function warehouseRoutes(router) {
  registerCrud(router, {
    base: 'warehouses', table: 'warehouses', searchable: ['code', 'name', 'location'],
    perms: 'warehouse', logModule: 'Warehouses',
  })

  // GET /api/warehouses/:id/stock — current location-based stock view.
  router.get('/api/warehouses/:id/stock', (ctx) => {
    const wh = ctx.db.prepare('SELECT * FROM warehouses WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.id))
    if (!wh) throw new HttpError(404, 'Warehouse not found.')
    const rows = ctx.db.prepare(
      `SELECT w.asset_id, asset.asset_code, asset.name AS asset_name, asset.category_id,
              SUM(CASE WHEN w.type = 'in' THEN w.quantity ELSE -w.quantity END) AS stock_qty,
              SUM(CASE WHEN w.type = 'out' THEN w.quantity ELSE 0 END) AS out_qty
       FROM warehouse_transactions w
       LEFT JOIN assets asset ON asset.id = w.asset_id
       WHERE w.warehouse_id = ? AND asset.deleted_at IS NULL
       GROUP BY w.asset_id HAVING stock_qty > 0`,
    ).all(wh.id)
    return ok('Warehouse stock retrieved successfully.', { data: rows })
  }, { auth: true, permission: 'warehouse.view' })

  // GET /api/warehouse-transactions
  router.get('/api/warehouse-transactions', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    let where = '1=1'
    const params = []
    if (ctx.query.warehouse_id) { where += ' AND wt.warehouse_id = ?'; params.push(Number(ctx.query.warehouse_id)) }
    if (ctx.query.asset_id) { where += ' AND wt.asset_id = ?'; params.push(Number(ctx.query.asset_id)) }
    if (ctx.query.type) { where += ' AND wt.type = ?'; params.push(ctx.query.type) }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM warehouse_transactions wt WHERE ${where}`).get(...params).c
    const rows = ctx.db.prepare(
      `SELECT wt.*, wh.name AS warehouse_name, asset.name AS asset_name, asset.asset_code, u.name AS user_name
       FROM warehouse_transactions wt
       LEFT JOIN warehouses wh ON wh.id = wt.warehouse_id
       LEFT JOIN assets asset ON asset.id = wt.asset_id
       LEFT JOIN users u ON u.id = wt.user_id
       WHERE ${where} ORDER BY wt.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, perPage, (page - 1) * perPage)
    return ok('Warehouse transactions retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'warehouse.view' })

  // POST /api/warehouse-transactions/transfer — move stock between warehouses.
  router.post('/api/warehouse-transactions/transfer', (ctx) => {
    const fromId = Number(ctx.body.from_warehouse_id)
    const toId = Number(ctx.body.to_warehouse_id)
    const asset = ctx.db.prepare('SELECT * FROM assets WHERE id = ?').get(Number(ctx.body.asset_id))
    if (!asset) throw new HttpError(404, 'Asset not found.')
    if (!fromId || !toId || fromId === toId) {
      throw new HttpError(422, 'Validation failed', { warehouse: ['Source and destination warehouses must differ.'] })
    }
    const fromWh = ctx.db.prepare('SELECT * FROM warehouses WHERE id = ?').get(fromId)
    const toWh = ctx.db.prepare('SELECT * FROM warehouses WHERE id = ?').get(toId)
    if (!fromWh || !toWh) throw new HttpError(404, 'Warehouse not found.')
    const quantity = Math.max(1, Number(ctx.body.quantity) || 1)

    const now = new Date().toISOString()
    const ins = ctx.db.prepare(
      `INSERT INTO warehouse_transactions (asset_id, warehouse_id, type, quantity, reference_type, reference_id, user_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const outInfo = ins.run(asset.id, fromId, 'out', quantity, 'transfer', null, ctx.user.id, `Transfer to ${toWh.name}`, now)
    const inInfo = ins.run(asset.id, toId, 'in', quantity, 'transfer', null, ctx.user.id, `Transfer from ${fromWh.name}`, now)
    log(ctx, 'transferred', 'Warehouses', { id: null, name: `${asset.name} → ${toWh.name}` })
    return ok('Stock transferred successfully.', {
      from: ctx.db.prepare('SELECT * FROM warehouse_transactions WHERE id = ?').get(Number(outInfo.lastInsertRowid)),
      to: ctx.db.prepare('SELECT * FROM warehouse_transactions WHERE id = ?').get(Number(inInfo.lastInsertRowid)),
    }, null, 201)
  }, { auth: true, permission: 'warehouse.transfer' })

  // POST /api/warehouse-transactions — stock in/out entry.
  router.post('/api/warehouse-transactions', (ctx) => {
    const type = ctx.body.type
    if (!['in', 'out'].includes(type)) throw new HttpError(422, 'Validation failed', { type: ['Type must be "in" or "out".'] })
    const asset = ctx.db.prepare('SELECT * FROM assets WHERE id = ?').get(Number(ctx.body.asset_id))
    if (!asset) throw new HttpError(404, 'Asset not found.')
    const quantity = Math.max(1, Number(ctx.body.quantity) || 1)

    const now = new Date().toISOString()
    const info = ctx.db.prepare(
      `INSERT INTO warehouse_transactions (asset_id, warehouse_id, type, quantity, reference_type, reference_id, user_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(asset.id, Number(ctx.body.warehouse_id), type, quantity,
      ctx.body.reference_type || null, ctx.body.reference_id || null, ctx.user.id, ctx.body.notes || null, now)

    // Recording a stock-out while an asset is physically stored marks it available for assignment again.
    if (type === 'out' && asset.status === 'assigned' && !ctx.body.keep_assigned) {
      ctx.db.prepare("UPDATE assets SET status = 'available', updated_at = ? WHERE id = ?").run(now, asset.id)
    }
    log(ctx, type === 'in' ? 'received' : 'transferred', 'Warehouses', { id: Number(info.lastInsertRowid), name: asset.name })
    return ok('Warehouse transaction recorded successfully.', ctx.db.prepare('SELECT * FROM warehouse_transactions WHERE id = ?').get(Number(info.lastInsertRowid)), null, 201)
  }, { auth: true, permission: 'warehouse.transfer' })
}
