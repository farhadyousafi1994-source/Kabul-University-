import { ok, HttpError } from '../server.js'

/**
 * ---------------------------------------------------------------------------
 * Statistics & global search
 * ---------------------------------------------------------------------------
 *
 *   GET /api/statistics/:module   aggregated counters for a module's summary
 *                                 cards, computed with SQL aggregation (never
 *                                 by paging the whole table into the browser)
 *   GET /api/search?q=            global search across the main record types
 *
 * The statistics endpoint accepts the SAME query parameters as the module's
 * list endpoint, so the cards can show either OVERALL totals (no params) or
 * FILTERED totals (the current filters) without a second contract.
 *
 * Every counter is returned as a flat `{ key: number }` map — labels, icons and
 * colours are the frontend's business (src/config/statistics.js), which keeps
 * the numbers translatable and the payload tiny.
 */

// --- helpers -----------------------------------------------------------------

const like = (value) => `%${String(value).toLowerCase()}%`

/** Build `WHERE` fragments shared by a list endpoint and its statistics. */
function buildFilter(query, { alias = '', searchable = [], equals = [], numeric = [] }) {
  const p = alias ? `${alias}.` : ''
  const clauses = [`${p}deleted_at IS NULL`]
  const params = []

  for (const col of equals) {
    if (query[col] !== undefined && query[col] !== '') {
      clauses.push(`${p}${col} = ?`)
      params.push(query[col])
    }
  }
  for (const col of numeric) {
    if (query[col] !== undefined && query[col] !== '') {
      clauses.push(`${p}${col} = ?`)
      params.push(Number(query[col]))
    }
  }

  const search = (query.search || '').trim()
  if (search && searchable.length) {
    clauses.push(`(${searchable.map((c) => `${c} LIKE ?`).join(' OR ')})`)
    searchable.forEach(() => params.push(like(search)))
  }

  return { where: clauses.join(' AND '), params }
}

/**
 * One pass over the filtered rows, counting each named bucket.
 * `buckets` is `{ key: 'SQL boolean expression' }`; the query becomes a single
 * `SELECT SUM(CASE WHEN … END)` so a module with ten cards still costs exactly
 * one aggregation — never ten round trips.
 */
function aggregate(db, { table, where, params, buckets, extras = {} }) {
  const parts = Object.entries(buckets).map(
    ([key, expr]) => `SUM(CASE WHEN ${expr} THEN 1 ELSE 0 END) AS "${key}"`,
  )
  for (const [key, expr] of Object.entries(extras)) parts.push(`${expr} AS "${key}"`)

  const row = db.prepare(`SELECT COUNT(*) AS total, ${parts.join(', ')} FROM ${table} WHERE ${where}`).get(...params)
  const out = {}
  for (const [key, value] of Object.entries(row || {})) out[key] = Number(value) || 0
  return out
}

// --- module definitions ------------------------------------------------------
//
// Each module declares how its rows are filtered and which buckets its cards
// need. Adding a module here is all it takes for a new page to get statistics.

const MODULES = {
  assets: {
    permission: 'assets.view',
    build: (db, query) => {
      const { where, params } = buildFilter(query, {
        alias: 'a',
        searchable: ['a.asset_code', 'a.name', 'a.serial_number', 'a.brand', 'a.model'],
        equals: ['status', 'condition'],
        numeric: ['category_id', 'subcategory_id', 'campus_id', 'faculty_id', 'department_id', 'building_id', 'floor_id', 'room_id', 'supplier_id', 'employee_id'],
      })
      return aggregate(db, {
        table: 'assets a',
        where,
        params,
        buckets: {
          available: "a.status = 'available'",
          assigned: "a.status = 'assigned'",
          reserved: "a.status = 'reserved'",
          under_maintenance: "a.status = 'under_maintenance'",
          damaged: "a.status = 'damaged'",
          retired: "a.status IN ('retired', 'disposed')",
          lost: "a.status IN ('lost', 'stolen')",
        },
        extras: {
          total_value: 'COALESCE(SUM(a.current_value), 0)',
          purchase_value: 'COALESCE(SUM(a.purchase_price), 0)',
        },
      })
    },
  },

  employees: {
    permission: 'employees.view',
    build: (db, query) => {
      const { where, params } = buildFilter(query, {
        alias: 'e',
        searchable: ['e.employee_code', 'e.first_name', 'e.last_name', 'e.email', 'e.position'],
        equals: ['status', 'employment_type'],
        numeric: ['department_id'],
      })
      const base = aggregate(db, {
        table: 'employees e',
        where,
        params,
        buckets: {
          active: "e.status = 'active'",
          inactive: "e.status = 'inactive'",
          on_leave: "e.status = 'on_leave'",
          with_assets: '(SELECT COUNT(*) FROM assets a WHERE a.employee_id = e.id AND a.deleted_at IS NULL) > 0',
        },
        extras: {
          departments: 'COUNT(DISTINCT e.department_id)',
        },
      })
      base.new_this_month = db.prepare(
        `SELECT COUNT(*) AS c FROM employees e WHERE ${where} AND e.hire_date >= ?`,
      ).get(...params, new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)).c
      return base
    },
  },

  assignments: {
    permission: 'assets.view',
    build: (db, query) => {
      const clauses = ['1 = 1']
      const params = []
      if (query.status) { clauses.push('aa.status = ?'); params.push(query.status) }
      if (query.employee_id) { clauses.push('aa.employee_id = ?'); params.push(Number(query.employee_id)) }
      if (query.asset_id) { clauses.push('aa.asset_id = ?'); params.push(Number(query.asset_id)) }
      const search = (query.search || '').trim()
      if (search) {
        clauses.push("(a.asset_code LIKE ? OR a.name LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ?)")
        for (let i = 0; i < 5; i += 1) params.push(like(search))
      }
      const today = new Date().toISOString().slice(0, 10)
      return aggregate(db, {
        table: `asset_assignments aa
                LEFT JOIN assets a ON a.id = aa.asset_id
                LEFT JOIN employees e ON e.id = aa.employee_id`,
        where: clauses.join(' AND '),
        params,
        buckets: {
          active: "aa.status = 'active'",
          returned: "aa.status = 'returned'",
          overdue: `aa.status = 'active' AND aa.expected_return_date IS NOT NULL AND aa.expected_return_date < '${today}'`,
          pending_return: `aa.status = 'active' AND aa.expected_return_date IS NOT NULL AND aa.expected_return_date >= '${today}'`,
        },
        extras: { employees: 'COUNT(DISTINCT aa.employee_id)' },
      })
    },
  },

  categories: {
    permission: 'categories.view',
    build: (db, query) => {
      const { where, params } = buildFilter(query, {
        alias: 'c',
        searchable: ['c.code', 'c.name', 'c.description'],
        equals: ['status'],
      })
      return aggregate(db, {
        table: 'asset_categories c',
        where,
        params,
        buckets: {
          active: "c.status = 'active'",
          inactive: "c.status != 'active'",
          with_assets: '(SELECT COUNT(*) FROM assets a WHERE a.category_id = c.id AND a.deleted_at IS NULL) > 0',
          empty: '(SELECT COUNT(*) FROM assets a WHERE a.category_id = c.id AND a.deleted_at IS NULL) = 0',
        },
      })
    },
  },

  subcategories: {
    permission: 'categories.view',
    build: (db, query) => {
      const { where, params } = buildFilter(query, {
        alias: 's',
        searchable: ['s.code', 's.name'],
        equals: ['status'],
        numeric: ['category_id'],
      })
      return aggregate(db, {
        table: 'asset_subcategories s',
        where,
        params,
        buckets: {
          active: "s.status = 'active'",
          inactive: "s.status != 'active'",
          with_assets: '(SELECT COUNT(*) FROM assets a WHERE a.subcategory_id = s.id AND a.deleted_at IS NULL) > 0',
          empty: '(SELECT COUNT(*) FROM assets a WHERE a.subcategory_id = s.id AND a.deleted_at IS NULL) = 0',
        },
      })
    },
  },

  users: {
    permission: 'users.view',
    build: (db, query) => {
      const { where, params } = buildFilter(query, {
        alias: 'u',
        searchable: ['u.name', 'u.username', 'u.email'],
        equals: ['status'],
        numeric: ['department_id'],
      })
      const base = aggregate(db, {
        table: 'users u',
        where,
        params,
        buckets: {
          active: "u.status = 'active'",
          inactive: "u.status != 'active'",
        },
      })
      base.administrators = db.prepare(
        `SELECT COUNT(DISTINCT u.id) AS c FROM users u
         JOIN role_user ru ON ru.user_id = u.id
         JOIN roles r ON r.id = ru.role_id
         WHERE ${where} AND (r.name LIKE '%Admin%')`,
      ).get(...params).c
      base.roles = db.prepare('SELECT COUNT(*) AS c FROM roles').get().c
      return base
    },
  },

  suppliers: {
    permission: 'suppliers.view',
    build: (db, query) => {
      const { where, params } = buildFilter(query, {
        alias: 's',
        searchable: ['s.name', 's.code', 's.email', 's.phone'],
        equals: ['status'],
      })
      return aggregate(db, {
        table: 'suppliers s',
        where,
        params,
        buckets: {
          active: "s.status = 'active'",
          inactive: "s.status != 'active'",
          with_assets: '(SELECT COUNT(*) FROM assets a WHERE a.supplier_id = s.id AND a.deleted_at IS NULL) > 0',
        },
      })
    },
  },

  maintenance: {
    permission: 'maintenance.view',
    build: (db, query) => {
      const clauses = ['1 = 1']
      const params = []
      if (query.status) { clauses.push('m.status = ?'); params.push(query.status) }
      if (query.asset_id) { clauses.push('m.asset_id = ?'); params.push(Number(query.asset_id)) }
      return aggregate(db, {
        table: 'asset_maintenances m',
        where: clauses.join(' AND '),
        params,
        buckets: {
          requested: "m.status = 'requested'",
          in_progress: "m.status IN ('approved', 'in_progress')",
          completed: "m.status = 'completed'",
          cancelled: "m.status = 'cancelled'",
        },
        extras: { total_cost: 'COALESCE(SUM(m.cost), 0)' },
      })
    },
  },

  incidents: {
    permission: 'incidents.view',
    build: (db, query) => {
      const clauses = ['1 = 1']
      const params = []
      if (query.status) { clauses.push('i.status = ?'); params.push(query.status) }
      return aggregate(db, {
        table: 'asset_incidents i',
        where: clauses.join(' AND '),
        params,
        buckets: {
          open: "i.status IN ('reported', 'open', 'investigating')",
          resolved: "i.status = 'resolved'",
          closed: "i.status = 'closed'",
        },
      })
    },
  },

  transfers: {
    permission: 'assets.view',
    build: (db, query) => {
      const clauses = ['1 = 1']
      const params = []
      if (query.status) { clauses.push('t.status = ?'); params.push(query.status) }
      return aggregate(db, {
        table: 'asset_transfers t',
        where: clauses.join(' AND '),
        params,
        buckets: {
          pending: "t.status = 'pending'",
          approved: "t.status = 'approved'",
          completed: "t.status = 'completed'",
          rejected: "t.status IN ('rejected', 'cancelled')",
        },
      })
    },
  },

  requests: {
    permission: 'requests.view',
    build: (db, query) => {
      const clauses = ['1 = 1']
      const params = []
      if (query.status) { clauses.push('r.status = ?'); params.push(query.status) }
      return aggregate(db, {
        table: 'asset_requests r',
        where: clauses.join(' AND '),
        params,
        buckets: {
          pending: "r.status = 'pending'",
          approved: "r.status = 'approved'",
          rejected: "r.status = 'rejected'",
          fulfilled: "r.status = 'fulfilled'",
        },
      })
    },
  },

  audits: {
    permission: 'audit.view',
    build: (db, query) => {
      const clauses = ['1 = 1']
      const params = []
      if (query.status) { clauses.push('a.status = ?'); params.push(query.status) }
      return aggregate(db, {
        table: 'asset_audits a',
        where: clauses.join(' AND '),
        params,
        buckets: {
          planned: "a.status IN ('planned', 'scheduled')",
          in_progress: "a.status = 'in_progress'",
          completed: "a.status = 'completed'",
          cancelled: "a.status = 'cancelled'",
        },
      })
    },
  },

  disposals: {
    permission: 'assets.dispose',
    build: (db) => aggregate(db, {
      table: 'asset_disposals d',
      where: '1 = 1',
      params: [],
      buckets: {
        draft: "d.status = 'draft'",
        pending: "d.status = 'pending'",
        approved: "d.status = 'approved'",
        completed: "d.status = 'completed'",
      },
      extras: { proceeds: 'COALESCE(SUM(d.revenue), 0)' },
    }),
  },

  warehouses: {
    permission: 'warehouse.view',
    build: (db, query) => {
      const { where, params } = buildFilter(query, {
        alias: 'w',
        searchable: ['w.name', 'w.code'],
        equals: ['status'],
      })
      return aggregate(db, {
        table: 'warehouses w',
        where,
        params,
        buckets: {
          active: "w.status = 'active'",
          inactive: "w.status != 'active'",
        },
        extras: { transactions: '(SELECT COUNT(*) FROM warehouse_transactions)' },
      })
    },
  },

  procurement: {
    permission: 'procurement.view',
    build: (db) => {
      const orders = aggregate(db, {
        table: 'purchase_orders o',
        where: '1 = 1',
        params: [],
        buckets: {
          draft: "o.status = 'draft'",
          sent: "o.status = 'sent'",
          received: "o.status = 'received'",
        },
        extras: { value: 'COALESCE(SUM(o.total), 0)' },
      })
      const requests = db.prepare('SELECT COUNT(*) AS c FROM purchase_requests').get().c
      return { ...orders, requests }
    },
  },

  activity: {
    permission: 'reports.view',
    build: (db) => {
      const today = new Date().toISOString().slice(0, 10)
      const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
      return aggregate(db, {
        table: 'activity_logs l',
        where: '1 = 1',
        params: [],
        buckets: {
          today: `l.created_at >= '${today}'`,
          this_week: `l.created_at >= '${week}'`,
          created: "l.action = 'created'",
          updated: "l.action = 'updated'",
          deleted: "l.action = 'deleted'",
        },
        extras: { users: 'COUNT(DISTINCT l.user_id)' },
      })
    },
  },
}

// Organization modules all share the same simple shape.
for (const [module, table] of Object.entries({
  campuses: 'campuses',
  faculties: 'faculties',
  departments: 'departments',
  buildings: 'buildings',
  floors: 'floors',
  rooms: 'rooms',
})) {
  MODULES[module] = {
    permission: 'organization.view',
    build: (db, query) => {
      const { where, params } = buildFilter(query, {
        alias: 'o',
        searchable: ['o.name', 'o.code'],
        equals: ['status'],
        numeric: ['campus_id', 'faculty_id', 'building_id', 'floor_id', 'department_id'],
      })
      const assetColumn = {
        campuses: 'campus_id',
        faculties: 'faculty_id',
        departments: 'department_id',
        buildings: 'building_id',
        floors: 'floor_id',
        rooms: 'room_id',
      }[module]
      return aggregate(db, {
        table: `${table} o`,
        where,
        params,
        buckets: {
          active: "o.status = 'active'",
          inactive: "o.status != 'active'",
          with_assets: `(SELECT COUNT(*) FROM assets a WHERE a.${assetColumn} = o.id AND a.deleted_at IS NULL) > 0`,
          empty: `(SELECT COUNT(*) FROM assets a WHERE a.${assetColumn} = o.id AND a.deleted_at IS NULL) = 0`,
        },
      })
    },
  }
}

export function statisticsRoutes(router) {
  // GET /api/statistics/:module — one aggregated query, permission-checked.
  router.get('/api/statistics/:module', (ctx) => {
    const module = String(ctx.params.module || '')
    const definition = MODULES[module]
    if (!definition) throw new HttpError(404, `No statistics are defined for "${module}".`)

    // Permissions are enforced per module (the route table cannot know which
    // one is requested up front).
    if (definition.permission && !ctx.can(definition.permission)) {
      throw new HttpError(403, 'This action is unauthorized.')
    }

    return ok('Statistics retrieved successfully.', {
      module,
      // `filtered` tells the UI whether the numbers describe all records or the
      // current filter selection, so the cards can label themselves honestly.
      filtered: Object.keys(ctx.query).some((k) => !['_', 'page', 'per_page'].includes(k) && ctx.query[k] !== ''),
      stats: definition.build(ctx.db, ctx.query),
    })
  }, { auth: true })
}

// ---------------------------------------------------------------------------
// Global search
// ---------------------------------------------------------------------------

export function globalSearchRoutes(router) {
  router.get('/api/search', (ctx) => {
    const term = String(ctx.query.q || ctx.query.search || '').trim()
    const limit = Math.min(10, Number(ctx.query.limit) || 5)
    if (term.length < 2) return ok('Search results retrieved successfully.', { query: term, groups: [] })

    const has = (permission) => ctx.can(permission)
    const q = like(term)
    const groups = []

    const push = (key, permission, rows) => {
      if (!permission || !has(permission)) return
      if (rows.length) groups.push({ key, items: rows })
    }

    push('assets', 'assets.view', ctx.db.prepare(
      `SELECT a.id, a.name AS title,
              TRIM(COALESCE(a.asset_code, '') || ' · ' || COALESCE(c.name, '') || ' · ' || COALESCE(a.status, '')) AS subtitle,
              a.status
       FROM assets a LEFT JOIN asset_categories c ON c.id = a.category_id
       WHERE a.deleted_at IS NULL AND (a.name LIKE ? OR a.asset_code LIKE ? OR a.serial_number LIKE ?
             OR a.barcode LIKE ? OR a.qr_code LIKE ? OR a.brand LIKE ? OR a.model LIKE ?)
       ORDER BY a.name LIMIT ?`,
    ).all(q, q, q, q, q, q, q, limit))

    push('employees', 'employees.view', ctx.db.prepare(
      `SELECT e.id, TRIM(e.first_name || ' ' || e.last_name) AS title,
              TRIM(COALESCE(e.employee_code, '') || ' · ' || COALESCE(d.name, '') || ' · ' || COALESCE(e.position, '')) AS subtitle,
              e.status
       FROM employees e LEFT JOIN departments d ON d.id = e.department_id
       WHERE e.deleted_at IS NULL AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ?
             OR e.email LIKE ? OR e.position LIKE ?)
       ORDER BY e.first_name LIMIT ?`,
    ).all(q, q, q, q, q, limit))

    push('assignments', 'assets.view', ctx.db.prepare(
      `SELECT aa.id, (COALESCE(a.name, 'Asset') || ' → ' || COALESCE(TRIM(e.first_name || ' ' || e.last_name), 'Unassigned')) AS title,
              TRIM(COALESCE(a.asset_code, '') || ' · ' || COALESCE(aa.status, '')) AS subtitle,
              aa.status, aa.asset_id
       FROM asset_assignments aa
       LEFT JOIN assets a ON a.id = aa.asset_id
       LEFT JOIN employees e ON e.id = aa.employee_id
       WHERE a.name LIKE ? OR a.asset_code LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ?
       ORDER BY aa.id DESC LIMIT ?`,
    ).all(q, q, q, q, q, limit))

    push('categories', 'categories.view', ctx.db.prepare(
      `SELECT id, name AS title, code AS subtitle, status FROM asset_categories
       WHERE deleted_at IS NULL AND (name LIKE ? OR code LIKE ?) ORDER BY name LIMIT ?`,
    ).all(q, q, limit))

    push('departments', 'organization.view', ctx.db.prepare(
      `SELECT id, name AS title, code AS subtitle, status FROM departments
       WHERE deleted_at IS NULL AND (name LIKE ? OR code LIKE ?) ORDER BY name LIMIT ?`,
    ).all(q, q, limit))

    push('rooms', 'organization.view', ctx.db.prepare(
      `SELECT id, name AS title, code AS subtitle, status FROM rooms
       WHERE deleted_at IS NULL AND (name LIKE ? OR code LIKE ?) ORDER BY name LIMIT ?`,
    ).all(q, q, limit))

    push('suppliers', 'suppliers.view', ctx.db.prepare(
      `SELECT id, name AS title, COALESCE(code, email) AS subtitle, status FROM suppliers
       WHERE deleted_at IS NULL AND (name LIKE ? OR code LIKE ? OR email LIKE ?) ORDER BY name LIMIT ?`,
    ).all(q, q, q, limit))

    push('users', 'users.view', ctx.db.prepare(
      `SELECT id, name AS title, (username || ' · ' || email) AS subtitle, status FROM users
       WHERE deleted_at IS NULL AND (name LIKE ? OR username LIKE ? OR email LIKE ?) ORDER BY name LIMIT ?`,
    ).all(q, q, q, limit))

    return ok('Search results retrieved successfully.', { query: term, groups })
  }, { auth: true })
}
