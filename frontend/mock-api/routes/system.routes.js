import { ok, HttpError } from '../server.js'
import { log } from './crud.helper.js'

/**
 * Module 23 — Reports & exports, Module 24 — Settings.
 * Report names mirror backend/routes/api/system.php whereIn('report', [...]).
 */
export function settingsRoutes(router) {
  router.get('/api/settings', (ctx) => {
    const rows = ctx.db.prepare('SELECT key, value, "group", type FROM settings ORDER BY "group", key').all()
    const grouped = {}
    for (const r of rows) {
      if (!grouped[r.group]) grouped[r.group] = {}
      grouped[r.group][r.key] = r.type === 'boolean' ? r.value === '1' || r.value === 'true' : r.value
    }
    return ok('Settings retrieved successfully.', grouped)
  }, { auth: true, permission: 'settings.manage' })

  router.put('/api/settings', (ctx) => {
    const now = new Date().toISOString()
    let saved = 0
    for (const [key, value] of Object.entries(ctx.body || {})) {
      const existing = ctx.db.prepare('SELECT * FROM settings WHERE key = ?').get(key)
      const stringValue = typeof value === 'boolean' ? (value ? '1' : '0') : String(value ?? '')
      if (existing) {
        ctx.db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').run(stringValue, now, key)
      } else {
        ctx.db.prepare('INSERT INTO settings (key, value, "group", type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(key, stringValue, 'general', 'string', now, now)
      }
      saved++
    }
    log(ctx, 'updated', 'Settings', { id: null, name: `${saved} setting(s) updated` })
    return ok('Settings saved successfully.', { saved })
  }, { auth: true, permission: 'settings.manage' })
}

const REPORT_DEFS = [
  { name: 'asset_register', title: 'Asset Register', description: 'All assets with codes, values and locations' },
  { name: 'assets_by_category', title: 'Assets by Category', description: 'Asset counts grouped by category' },
  { name: 'assets_by_location', title: 'Assets by Location', description: 'Asset counts grouped by department' },
  { name: 'assigned_assets', title: 'Assigned Assets', description: 'Assets currently assigned to employees' },
  { name: 'available_assets', title: 'Available Assets', description: 'Assets currently available for assignment' },
  { name: 'maintenance_history', title: 'Maintenance History', description: 'All maintenance work orders' },
  { name: 'maintenance_cost', title: 'Maintenance Cost', description: 'Costs grouped by type and status' },
  { name: 'asset_value', title: 'Asset Value', description: 'Purchase vs current value per asset' },
  { name: 'depreciation_schedule', title: 'Depreciation Schedule', description: 'Depreciation records by period' },
  { name: 'disposal_report', title: 'Disposal Report', description: 'All disposal requests and outcomes' },
  { name: 'audit_missing', title: 'Audit — Missing Assets', description: 'Audit items verified as missing' },
  { name: 'audit_damaged', title: 'Audit — Damaged Assets', description: 'Audit items verified as damaged' },
]

export function reportRoutes(router) {
  // GET /api/reports — list of available report types.
  router.get('/api/reports', (ctx) => {
    return ok('Reports retrieved successfully.', { data: REPORT_DEFS })
  }, { auth: true, permission: 'reports.view' })

  function reportQuery(name, ctx) {
    const rowsFor = (sql) => ctx.db.prepare(sql).all()
    switch (name) {
      case 'asset_register':
        return {
          title: 'Asset Register',
          rows: rowsFor(
            `SELECT a.asset_code, a.name, c.name AS category, a.brand, a.model, a.serial_number,
                    a.status, a.condition, a.purchase_date, a.purchase_price, a.current_value,
                    s.name AS supplier, cm.name AS campus, d.name AS department
             FROM assets a
             LEFT JOIN asset_categories c ON c.id = a.category_id
             LEFT JOIN suppliers s ON s.id = a.supplier_id
             LEFT JOIN campuses cm ON cm.id = a.campus_id
             LEFT JOIN departments d ON d.id = a.department_id
             WHERE a.deleted_at IS NULL ORDER BY a.asset_code`,
          ),
        }
      case 'assets_by_category':
        return {
          title: 'Assets by Category',
          rows: rowsFor(
            `SELECT c.name AS category, COUNT(*) AS total,
                    SUM(CASE WHEN a.status = 'available' THEN 1 ELSE 0 END) AS available,
                    SUM(CASE WHEN a.status = 'assigned' THEN 1 ELSE 0 END) AS assigned,
                    SUM(CASE WHEN a.status = 'under_maintenance' THEN 1 ELSE 0 END) AS under_maintenance
             FROM assets a LEFT JOIN asset_categories c ON c.id = a.category_id
             WHERE a.deleted_at IS NULL GROUP BY c.id ORDER BY total DESC`,
          ),
        }
      case 'assets_by_location':
        return {
          title: 'Assets by Location',
          rows: rowsFor(
            `SELECT COALESCE(d.name, 'Unassigned') AS department, cm.name AS campus, COUNT(*) AS total
             FROM assets a
             LEFT JOIN departments d ON d.id = a.department_id
             LEFT JOIN campuses cm ON cm.id = a.campus_id
             WHERE a.deleted_at IS NULL GROUP BY d.id, cm.id ORDER BY total DESC`,
          ),
        }
      case 'assigned_assets':
        return {
          title: 'Assigned Assets',
          rows: rowsFor(
            `SELECT asset.asset_code, asset.name AS asset_name, u.name AS assignee,
                    a.assigned_date, a.expected_return_date, a.status
             FROM asset_assignments a
             LEFT JOIN assets asset ON asset.id = a.asset_id
             LEFT JOIN users u ON u.id = a.assigned_to_user_id
             WHERE a.status = 'active' ORDER BY a.assigned_date DESC`,
          ),
        }
      case 'available_assets':
        return {
          title: 'Available Assets',
          rows: rowsFor(
            `SELECT asset_code, name, purchase_price, current_value, condition
             FROM assets WHERE status = 'available' AND deleted_at IS NULL
             ORDER BY asset_code`,
          ),
        }
      case 'maintenance_history':
        return {
          title: 'Maintenance History',
          rows: rowsFor(
            `SELECT asset.asset_code, asset.name AS asset_name, am.maintenance_type,
                    am.start_date, am.end_date, am.cost, am.status, tech.name AS technician
             FROM asset_maintenances am
             LEFT JOIN assets asset ON asset.id = am.asset_id
             LEFT JOIN users tech ON tech.id = am.technician_id
             ORDER BY am.created_at DESC`,
          ),
        }
      case 'maintenance_cost':
        return {
          title: 'Maintenance Cost',
          rows: rowsFor(
            `SELECT maintenance_type, status,
                    COUNT(*) AS work_orders, SUM(cost) AS total_cost
             FROM asset_maintenances GROUP BY maintenance_type, status
             ORDER BY total_cost DESC`,
          ),
        }
      case 'asset_value':
        return {
          title: 'Asset Value',
          rows: rowsFor(
            `SELECT asset_code, name, purchase_price, current_value,
                    (purchase_price - current_value) AS depreciated_amount
             FROM assets WHERE deleted_at IS NULL ORDER BY purchase_price DESC`,
          ),
        }
      case 'depreciation_schedule':
        return {
          title: 'Depreciation Schedule',
          rows: rowsFor(
            `SELECT asset.asset_code, asset.name AS asset_name, d.period, d.original_value,
                    d.accumulated_depreciation, d.book_value
             FROM asset_depreciations d
             LEFT JOIN assets asset ON asset.id = d.asset_id
             ORDER BY d.period DESC, asset.asset_code`,
          ),
        }
      case 'disposal_report':
        return {
          title: 'Disposal Report',
          rows: rowsFor(
            `SELECT asset.asset_code, asset.name AS asset_name, d.method, d.request_date,
                    d.approval_date, d.disposal_date, d.status, d.revenue
             FROM asset_disposals d
             LEFT JOIN assets asset ON asset.id = d.asset_id
             ORDER BY d.created_at DESC`,
          ),
        }
      case 'audit_missing':
        return {
          title: 'Audit — Missing Assets',
          rows: rowsFor(
            `SELECT a.audit_code, asset.asset_code, asset.name AS asset_name, ai.notes, ai.scanned_at
             FROM asset_audit_items ai
             LEFT JOIN asset_audits a ON a.id = ai.asset_audit_id
             LEFT JOIN assets asset ON asset.id = ai.asset_id
             WHERE ai.verification = 'missing' ORDER BY ai.scanned_at DESC`,
          ),
        }
      case 'audit_damaged':
        return {
          title: 'Audit — Damaged Assets',
          rows: rowsFor(
            `SELECT a.audit_code, asset.asset_code, asset.name AS asset_name, ai.notes, ai.scanned_at
             FROM asset_audit_items ai
             LEFT JOIN asset_audits a ON a.id = ai.asset_audit_id
             LEFT JOIN assets asset ON asset.id = ai.asset_id
             WHERE ai.verification = 'damaged' ORDER BY ai.scanned_at DESC`,
          ),
        }
      default:
        return null
    }
  }

  // GET /api/reports/:name — JSON data.
  router.get('/api/reports/:name', (ctx) => {
    const q = reportQuery(ctx.params.name, ctx)
    if (!q) throw new HttpError(404, 'Unknown report type.')
    return ok('Report retrieved successfully.', {
      name: ctx.params.name,
      title: q.title,
      generated_at: new Date().toISOString(),
      rows: q.rows,
    })
  }, { auth: true, permission: 'reports.view' })

  // GET /api/reports/:name/export — CSV download (UTF-8 BOM so Excel opens it cleanly).
  router.get('/api/reports/:name/export', (ctx) => {
    const q = reportQuery(ctx.params.name, ctx)
    if (!q) throw new HttpError(404, 'Unknown report type.')
    if (!q.rows.length) throw new HttpError(422, 'Validation failed', { rows: ['No data to export for this report.'] })

    const headers = Object.keys(q.rows[0])
    const esc = (v) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [headers.join(','), ...q.rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
    ctx.res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${ctx.params.name}-${new Date().toISOString().slice(0, 10)}.csv"`,
    })
    ctx.res.end('\uFEFF' + csv)
  }, { auth: true, permission: 'reports.view' })
}
