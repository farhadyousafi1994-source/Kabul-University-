import { ok } from '../server.js'

/**
 * Module 26 — Dashboard.
 * Aggregates statistics, chart series and feed widgets.
 */
export function dashboardRoutes(router) {
  // GET /api/dashboard/stats
  router.get('/api/dashboard/stats', (ctx) => {
    const db = ctx.db

    const count = (where) =>
      db.prepare(`SELECT COUNT(*) AS c FROM assets WHERE deleted_at IS NULL AND ${where}`).get().c

    const purchase = db
      .prepare('SELECT COALESCE(SUM(purchase_price), 0) AS v FROM assets WHERE deleted_at IS NULL')
      .get().v
    const current = db
      .prepare('SELECT COALESCE(SUM(current_value), 0) AS v FROM assets WHERE deleted_at IS NULL')
      .get().v

    return ok('Dashboard statistics retrieved successfully.', {
      total_assets: count('1=1'),
      available_assets: count("status = 'available'"),
      assigned_assets: count("status = 'assigned'"),
      under_maintenance: count("status = 'under_maintenance'"),
      damaged_assets: count("status = 'damaged'"),
      lost_assets: count("status = 'lost'"),
      stolen_assets: count("status = 'stolen'"),
      disposed_assets: count("status = 'disposed'"),
      retired_assets: count("status = 'retired'"),
      reserved_assets: count("status = 'reserved'"),
      total_users: db.prepare('SELECT COUNT(*) AS c FROM users WHERE deleted_at IS NULL').get().c,
      total_suppliers: db.prepare('SELECT COUNT(*) AS c FROM suppliers WHERE deleted_at IS NULL').get().c,
      open_maintenance: db
        .prepare("SELECT COUNT(*) AS c FROM asset_maintenances WHERE status IN ('requested','approved','in_progress')")
        .get().c,
      expiring_warranties: db
        .prepare(
          "SELECT COUNT(*) AS c FROM assets WHERE deleted_at IS NULL AND status != 'disposed' AND warranty_expiry_date IS NOT NULL AND warranty_expiry_date BETWEEN ? AND ?",
        )
        .get(new Date().toISOString().slice(0, 10), new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)).c,
      total_purchase_value: Math.round(purchase),
      current_value: Math.round(current),
      depreciated_value: Math.round(purchase - current),
    })
  }, { auth: true, permission: 'dashboard.view' })

  // GET /api/dashboard/charts
  router.get('/api/dashboard/charts', (ctx) => {
    const db = ctx.db

    const byCategory = db
      .prepare(
        `SELECT c.name AS label, COUNT(a.id) AS value FROM asset_categories c
         LEFT JOIN assets a ON a.category_id = c.id AND a.deleted_at IS NULL
         GROUP BY c.id ORDER BY value DESC`,
      )
      .all()

    const byStatus = db
      .prepare(
        `SELECT status AS label, COUNT(*) AS value FROM assets WHERE deleted_at IS NULL GROUP BY status ORDER BY value DESC`,
      )
      .all()
      .map((r) => ({ label: r.label.replace(/_/g, ' '), value: r.value }))

    const now = new Date()
    const acquisitions = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10)
      const c = db
        .prepare(
          `SELECT COUNT(*) AS c FROM assets WHERE deleted_at IS NULL AND purchase_date >= ? AND purchase_date < ?`,
        )
        .get(`${key}-01`, next).c
      acquisitions.push({ label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), value: c })
    }

    const maintenanceCosts = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10)
      const c = db
        .prepare(
          `SELECT COALESCE(SUM(cost), 0) AS v FROM asset_maintenances
           WHERE end_date IS NOT NULL AND end_date >= ? AND end_date < ? AND status = 'completed'`,
        )
        .get(`${key}-01`, next).v
      maintenanceCosts.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), value: Math.round(c) })
    }

    return ok('Dashboard charts retrieved successfully.', {
      by_category: byCategory,
      by_status: byStatus,
      acquisitions,
      maintenance_costs: maintenanceCosts,
    })
  }, { auth: true, permission: 'dashboard.view' })

  // GET /api/dashboard/recent-activities
  router.get('/api/dashboard/recent-activities', (ctx) => {
    const rows = ctx.db
      .prepare(
        `SELECT al.*, u.name AS user_name FROM activity_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ORDER BY al.created_at DESC LIMIT 8`,
      )
      .all()
    return ok('Recent activities retrieved successfully.', { data: rows })
  }, { auth: true, permission: 'dashboard.view' })

  // GET /api/dashboard/upcoming
  router.get('/api/dashboard/upcoming', (ctx) => {
    const db = ctx.db
    const today = new Date().toISOString().slice(0, 10)
    const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)

    const maintenance = db
      .prepare(
        `SELECT am.id, a.name AS asset_name, am.maintenance_type, am.status, am.start_date,
                am.scheduled_date
         FROM asset_maintenances am JOIN assets a ON a.id = am.asset_id
         WHERE am.status IN ('requested','approved') AND (am.scheduled_date IS NOT NULL OR am.start_date IS NOT NULL)
         ORDER BY COALESCE(am.scheduled_date, am.start_date) ASC LIMIT 6`,
      )
      .all()

    const warranties = db
      .prepare(
        `SELECT id, name AS asset_name, warranty_expiry_date FROM assets
         WHERE deleted_at IS NULL AND status != 'disposed' AND warranty_expiry_date BETWEEN ? AND ?
         ORDER BY warranty_expiry_date ASC LIMIT 6`,
      )
      .all(today, in90)

    return ok('Upcoming events retrieved successfully.', { maintenance, warranties })
  }, { auth: true, permission: 'dashboard.view' })
}
