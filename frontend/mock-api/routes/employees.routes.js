import { ok, HttpError } from '../server.js'
import { log } from './crud.helper.js'

/**
 * Employees module — dedicated HR directory, fully separated from `users`.
 *
 * Mirrors the Laravel contract:
 *
 *   GET    /api/employees              list + filters + pagination
 *   POST   /api/employees              create
 *   GET    /api/employees/:id          profile + asset summary
 *   PUT    /api/employees/:id          update
 *   DELETE /api/employees/:id          archive (blocked while assets assigned)
 *   GET    /api/employees/:id/assets   assets currently assigned to employee
 *
 * An employee MAY be linked to a user account through `user_id`, but the two
 * entities stay independent: employee CRUD never touches authentication data.
 */

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract']
const STATUSES = ['active', 'inactive', 'on_leave']

const EMPLOYEE_COLS = [
  'employee_code', 'first_name', 'last_name', 'email', 'phone', 'department_id',
  'position', 'job_title', 'employment_type', 'status', 'hire_date',
  'manager_id', 'address', 'notes', 'user_id',
]

const SELECT = `
  SELECT e.*,
         TRIM(e.first_name || ' ' || e.last_name) AS full_name,
         d.name  AS department_name,
         f.name  AS faculty_name,
         TRIM(m.first_name || ' ' || m.last_name) AS manager_name,
         u.username AS user_username,
         (SELECT COUNT(*) FROM assets a WHERE a.employee_id = e.id AND a.deleted_at IS NULL) AS assets_count
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN faculties f ON f.id = d.faculty_id
  LEFT JOIN employees m ON m.id = e.manager_id
  LEFT JOIN users u ON u.id = e.user_id
`

function findEmployee(db, id) {
  return db.prepare(`${SELECT} WHERE e.id = ? AND e.deleted_at IS NULL`).get(Number(id))
}

/**
 * Shared create/update validation. Throws HttpError(422) with field errors.
 */
function validate(ctx, { existing = null } = {}) {
  const body = ctx.body || {}
  const errors = {}
  const val = (k) => (body[k] !== undefined ? body[k] : existing?.[k])

  if (!String(val('first_name') || '').trim()) errors.first_name = ['The first name field is required.']
  if (!String(val('last_name') || '').trim()) errors.last_name = ['The last name field is required.']

  const email = val('email')
  if (email && !/^\S+@\S+\.\S+$/.test(String(email))) {
    errors.email = ['The email must be a valid email address.']
  } else if (email) {
    const clash = ctx.db.prepare('SELECT id FROM employees WHERE email = ? AND id != ?').get(String(email), existing?.id ?? 0)
    if (clash) errors.email = ['This email is already used by another employee.']
  }

  const code = val('employee_code')
  if (code) {
    const clash = ctx.db.prepare('SELECT id FROM employees WHERE employee_code = ? AND id != ?').get(String(code), existing?.id ?? 0)
    if (clash) errors.employee_code = ['This employee code is already in use.']
  }

  const type = val('employment_type')
  if (type && !EMPLOYMENT_TYPES.includes(type)) errors.employment_type = ['Invalid employment type.']
  const status = val('status')
  if (status && !STATUSES.includes(status)) errors.status = ['Invalid status.']

  if (body.department_id) {
    const dept = ctx.db.prepare('SELECT id FROM departments WHERE id = ? AND deleted_at IS NULL').get(Number(body.department_id))
    if (!dept) errors.department_id = ['The selected department does not exist.']
  }
  if (body.manager_id) {
    const mgr = ctx.db.prepare('SELECT id FROM employees WHERE id = ? AND deleted_at IS NULL').get(Number(body.manager_id))
    if (!mgr) errors.manager_id = ['The selected manager does not exist.']
    else if (existing && Number(body.manager_id) === existing.id) errors.manager_id = ['An employee cannot manage themselves.']
  }
  if (body.user_id) {
    const user = ctx.db.prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').get(Number(body.user_id))
    if (!user) errors.user_id = ['The selected user account does not exist.']
    else {
      const linked = ctx.db.prepare('SELECT id FROM employees WHERE user_id = ? AND id != ?').get(Number(body.user_id), existing?.id ?? 0)
      if (linked) errors.user_id = ['This user account is already linked to another employee.']
    }
  }

  if (Object.keys(errors).length) throw new HttpError(422, 'Validation failed', errors)
}

function nextEmployeeCode(db) {
  const last = db
    .prepare("SELECT employee_code FROM employees WHERE employee_code LIKE 'EMP-%' ORDER BY LENGTH(employee_code) DESC, employee_code DESC LIMIT 1")
    .get()
  const num = last ? Number(String(last.employee_code).replace(/\D+/g, '')) + 1 : 1
  return `EMP-${String(num).padStart(4, '0')}`
}

export function employeeRoutes(router) {
  // GET /api/employees — search + filters + sorting + pagination.
  router.get('/api/employees', (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    const search = (ctx.query.search || '').toLowerCase()

    let where = 'e.deleted_at IS NULL'
    const params = []
    if (ctx.query.department_id) { where += ' AND e.department_id = ?'; params.push(Number(ctx.query.department_id)) }
    if (ctx.query.status) { where += ' AND e.status = ?'; params.push(ctx.query.status) }
    if (ctx.query.employment_type) { where += ' AND e.employment_type = ?'; params.push(ctx.query.employment_type) }
    if (search) {
      where += ` AND (e.employee_code LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ?
                 OR (e.first_name || ' ' || e.last_name) LIKE ? OR e.email LIKE ? OR e.phone LIKE ? OR e.position LIKE ?)`
      for (let i = 0; i < 7; i++) params.push(`%${search}%`)
    }

    const sortMap = {
      employee_code: 'e.employee_code',
      full_name: 'e.first_name',
      department_name: 'd.name',
      position: 'e.position',
      employment_type: 'e.employment_type',
      status: 'e.status',
      hire_date: 'e.hire_date',
      assets_count: 'assets_count',
      created_at: 'e.created_at',
    }
    const sort = sortMap[ctx.query.sort] || 'e.first_name'
    const dir = (ctx.query.direction || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'

    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM employees e WHERE ${where}`).get(...params).c
    const rows = ctx.db
      .prepare(`${SELECT} WHERE ${where} ORDER BY ${sort} ${dir}, e.id ASC LIMIT ? OFFSET ?`)
      .all(...params, perPage, (page - 1) * perPage)

    return ok('Employees retrieved successfully.', {
      data: rows,
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
    })
  }, { auth: true, permission: 'employees.view' })

  // POST /api/employees
  router.post('/api/employees', (ctx) => {
    validate(ctx)
    const now = new Date().toISOString()
    const data = { created_at: now, updated_at: now }
    for (const k of EMPLOYEE_COLS) if (ctx.body[k] !== undefined) data[k] = ctx.body[k]
    if (!data.employee_code) data.employee_code = nextEmployeeCode(ctx.db)
    if (!data.employment_type) data.employment_type = 'full_time'
    if (!data.status) data.status = 'active'

    const keys = Object.keys(data)
    const info = ctx.db
      .prepare(`INSERT INTO employees (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
      .run(...keys.map((k) => data[k] ?? null))
    const row = findEmployee(ctx.db, Number(info.lastInsertRowid))

    log(ctx, 'created', 'Employees', { id: row.id, name: row.full_name })
    return ok('Employee created successfully.', row, null, 201)
  }, { auth: true, permission: 'employees.create' })

  // GET /api/employees/:id — profile + asset summary for the details page.
  router.get('/api/employees/:id', (ctx) => {
    const row = findEmployee(ctx.db, ctx.params.id)
    if (!row) throw new HttpError(404, 'Employee not found.')

    const summary = ctx.db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'under_maintenance' THEN 1 ELSE 0 END) AS under_maintenance,
             SUM(CASE WHEN status NOT IN ('under_maintenance', 'damaged', 'lost', 'stolen', 'disposed', 'retired') THEN 1 ELSE 0 END) AS active,
             COALESCE(SUM(current_value), 0) AS total_value
      FROM assets WHERE employee_id = ? AND deleted_at IS NULL
    `).get(row.id)

    return ok('Employee retrieved successfully.', {
      ...row,
      asset_summary: {
        total: summary.total || 0,
        active: summary.active || 0,
        under_maintenance: summary.under_maintenance || 0,
        total_value: summary.total_value || 0,
      },
    })
  }, { auth: true, permission: 'employees.view' })

  // GET /api/employees/:id/assets — the employee's assigned assets.
  router.get('/api/employees/:id/assets', (ctx) => {
    const row = ctx.db.prepare('SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.id))
    if (!row) throw new HttpError(404, 'Employee not found.')

    const assets = ctx.db.prepare(`
      SELECT a.id, a.asset_code, a.name, a.serial_number, a.status, a.condition,
             a.current_value, a.updated_at, c.name AS category_name
      FROM assets a
      LEFT JOIN asset_categories c ON c.id = a.category_id
      WHERE a.employee_id = ? AND a.deleted_at IS NULL
      ORDER BY a.updated_at DESC
    `).all(row.id)

    return ok('Employee assets retrieved successfully.', { data: assets })
  }, { auth: true, permission: 'employees.view' })

  // PUT /api/employees/:id
  router.put('/api/employees/:id', (ctx) => {
    const row = ctx.db.prepare('SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.id))
    if (!row) throw new HttpError(404, 'Employee not found.')
    validate(ctx, { existing: row })

    const sets = { updated_at: new Date().toISOString() }
    for (const k of EMPLOYEE_COLS) if (ctx.body[k] !== undefined) sets[k] = ctx.body[k]
    if (sets.employee_code === '' || sets.employee_code === null) delete sets.employee_code

    const keys = Object.keys(sets)
    ctx.db.prepare(`UPDATE employees SET ${keys.map((k) => `"${k}" = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map((k) => sets[k] ?? null), row.id)

    const fresh = findEmployee(ctx.db, row.id)
    log(ctx, 'updated', 'Employees', { id: fresh.id, name: fresh.full_name })
    return ok('Employee updated successfully.', fresh)
  }, { auth: true, permission: 'employees.update' })

  // DELETE /api/employees/:id — blocked while assets are still assigned.
  router.delete('/api/employees/:id', (ctx) => {
    const row = findEmployee(ctx.db, ctx.params.id)
    if (!row) throw new HttpError(404, 'Employee not found.')

    if (row.assets_count > 0) {
      throw new HttpError(
        422,
        `This employee still has ${row.assets_count} assigned asset(s). Unassign or reassign them before deleting the employee.`,
        { assets: ['Employee has assigned assets.'] },
      )
    }

    const now = new Date().toISOString()
    ctx.db.prepare('UPDATE employees SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, row.id)
    log(ctx, 'deleted', 'Employees', { id: row.id, name: row.full_name })
    return ok('Employee archived successfully.')
  }, { auth: true, permission: 'employees.delete' })
}
