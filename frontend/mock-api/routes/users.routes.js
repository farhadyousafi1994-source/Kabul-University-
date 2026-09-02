import { ok, HttpError } from '../server.js'
import { hashPassword } from '../server.js'
import { log } from './crud.helper.js'

/**
 * Module 3 — Users, roles & permissions.
 * Mirrors backend/routes/api/system.php users/roles groups.
 */
export function userRoutes(router) {
  const listUsers = (ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1)
    const perPage = Math.min(100, Number(ctx.query.per_page) || 20)
    const search = (ctx.query.search || '').toLowerCase()

    let where = 'u.deleted_at IS NULL'
    const params = []
    if (ctx.query.status) { where += ' AND u.status = ?'; params.push(ctx.query.status) }
    if (ctx.query.department_id) { where += ' AND u.department_id = ?'; params.push(Number(ctx.query.department_id)) }
    if (ctx.query.role_id) { where += ' AND EXISTS (SELECT 1 FROM role_user ru WHERE ru.user_id = u.id AND ru.role_id = ?)'; params.push(Number(ctx.query.role_id)) }
    if (search) {
      where += ' AND (u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    const total = ctx.db.prepare(`SELECT COUNT(*) AS c FROM users u WHERE ${where}`).get(...params).c
    const rows = ctx.db
      .prepare(`SELECT u.* FROM users u WHERE ${where} ORDER BY u.name ASC LIMIT ? OFFSET ?`)
      .all(...params, perPage, (page - 1) * perPage)
      .map((u) => router.serializeUser(u))
    return { data: rows, meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total } }
  }

  router.get('/api/users', (ctx) => {
    return ok('Users retrieved successfully.', listUsers(ctx))
  }, { auth: true, permission: 'users.view' })

  router.post('/api/users', (ctx) => {
    const { name, username, email, password, phone, department_id, role_ids } = ctx.body || {}
    const errors = {}
    if (!name) errors.name = ['The name field is required.']
    if (!username) errors.username = ['The username field is required.']
    if (!email) errors.email = ['The email field is required.']
    if (!password || String(password).length < 8) errors.password = ['The password must be at least 8 characters.']
    if (Object.keys(errors).length) throw new HttpError(422, 'Validation failed', errors)

    const taken = ctx.db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email)
    if (taken) throw new HttpError(422, 'Validation failed', { username: ['This username or email is already in use.'] })

    const now = new Date().toISOString()
    const info = ctx.db.prepare(
      `INSERT INTO users (name, username, email, phone, department_id, status, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    ).run(name, username, email, phone || null, department_id || null, hashPassword(password), now, now)
    const uid = Number(info.lastInsertRowid)
    const roleIds = Array.isArray(role_ids) ? role_ids : []
    for (const rid of roleIds) {
      ctx.db.prepare('INSERT INTO role_user (role_id, user_id) VALUES (?, ?)').run(Number(rid), uid)
    }
    log(ctx, 'created', 'Users', ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(uid))
    return ok('User created successfully.', router.serializeUser(ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(uid)), null, 201)
  }, { auth: true, permission: 'users.create' })

  // POST /api/users/bulk — CSV import of employees (must stay before /:id)
  router.post('/api/users/bulk', (ctx) => {
    const rows = Array.isArray(ctx.body?.rows) ? ctx.body.rows : []
    const created = []
    const errors = []
    const now = new Date().toISOString()
    const count = ctx.db.prepare('SELECT COUNT(*) AS c FROM users').get().c
    let n = count

    for (const [i, r] of rows.entries()) {
      const name = String(r.name || '').trim()
      const email = String(r.email || '').trim()
      if (!name) { errors.push({ row: i + 2, reason: 'name missing' }); continue }
      if (!email) { errors.push({ row: i + 2, reason: 'email missing' }); continue }

      const base = name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.+|\.+$/g, '') || `employee${n + 1}`
      let username = base
      let emailGuess = email
      if (!/^\S+@\S+\.\S+$/.test(emailGuess)) emailGuess = `${base}@ku.edu.af`
      let suffix = 1
      while (ctx.db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, emailGuess)) {
        suffix += 1
        username = `${base}${suffix}`
      }
      n += 1
      const info = ctx.db.prepare(
        `INSERT INTO users (name, username, email, phone, department_id, status, password_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      ).run(
        name, username, emailGuess, r.phone || null,
        r.department_id || null, hashPassword('password123'), now, now,
      )
      const uid = Number(info.lastInsertRowid)
      const rid = ctx.db.prepare("SELECT id FROM roles WHERE name = 'Employee'").get()
      if (rid) ctx.db.prepare('INSERT INTO role_user (role_id, user_id) VALUES (?, ?)').run(rid.id, uid)
      // HR data (employee code, position, employment type) goes to `employees`,
      // linked to the new account through employees.user_id.
      const [first, ...rest] = name.split(/\s+/)
      const nextCode = ctx.db
        .prepare("SELECT employee_code FROM employees WHERE employee_code LIKE 'EMP-%' ORDER BY LENGTH(employee_code) DESC, employee_code DESC LIMIT 1")
        .get()
      const num = nextCode ? Number(String(nextCode.employee_code).replace(/\D+/g, '')) + 1 : 1
      ctx.db.prepare(
        `INSERT INTO employees (employee_code, first_name, last_name, email, phone, department_id, position, job_title, employment_type, status, hire_date, user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      ).run(
        `EMP-${String(num).padStart(4, '0')}`, first || name, rest.join(' '),
        emailGuess, r.phone || null, r.department_id || null, r.position || null, r.position || null,
        r.hire_type === 'contract' ? 'contract' : 'full_time',
        now.slice(0, 10), uid, now, now,
      )
      created.push(uid)
      log(ctx, 'created', 'Users (bulk import)', { id: uid, name })
    }
    return ok('Bulk import finished.', { created: created.length, errors }, null, errors.length && !created.length ? 422 : 200)
  }, { auth: true, permission: 'users.create' })

  router.get('/api/users/:id', (ctx) => {
    const user = ctx.db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.id))
    if (!user) throw new HttpError(404, 'User not found.')
    return ok('User retrieved successfully.', router.serializeUser(user))
  }, { auth: true, permission: 'users.view' })

  router.put('/api/users/:id', (ctx) => {
    const user = ctx.db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.id))
    if (!user) throw new HttpError(404, 'User not found.')

    const cols = ['name', 'email', 'phone', 'department_id', 'status']
    const sets = { updated_at: new Date().toISOString() }
    for (const c of cols) if (ctx.body[c] !== undefined) sets[c] = ctx.body[c]
    if (ctx.body.password) sets.password_hash = hashPassword(ctx.body.password)
    const keys = Object.keys(sets)
    ctx.db.prepare(`UPDATE users SET ${keys.map((k) => `"${k}" = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map((k) => sets[k]), user.id)

    if (Array.isArray(ctx.body.role_ids)) {
      ctx.db.prepare('DELETE FROM role_user WHERE user_id = ?').run(user.id)
      for (const rid of ctx.body.role_ids) {
        ctx.db.prepare('INSERT INTO role_user (role_id, user_id) VALUES (?, ?)').run(Number(rid), user.id)
      }
    }
    log(ctx, 'updated', 'Users', user)
    return ok('User updated successfully.', router.serializeUser(ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)))
  }, { auth: true, permission: 'users.update' })

  router.delete('/api/users/:id', (ctx) => {
    const user = ctx.db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.id))
    if (!user) throw new HttpError(404, 'User not found.')
    if (user.id === ctx.user.id) throw new HttpError(422, 'Validation failed', { id: ['You cannot archive your own account.'] })
    ctx.db.prepare("UPDATE users SET deleted_at = ?, updated_at = ?, status = 'inactive' WHERE id = ?")
      .run(new Date().toISOString(), new Date().toISOString(), user.id)
    log(ctx, 'deleted', 'Users', user)
    return ok('User archived successfully.')
  }, { auth: true, permission: 'users.delete' })

  router.post('/api/users/:id/activate', (ctx) => {
    const user = ctx.db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.id))
    if (!user) throw new HttpError(404, 'User not found.')
    ctx.db.prepare("UPDATE users SET status = 'active', updated_at = ? WHERE id = ?").run(new Date().toISOString(), user.id)
    log(ctx, 'activated', 'Users', user)
    return ok('User activated successfully.', router.serializeUser(ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)))
  }, { auth: true, permission: 'users.update' })

  router.post('/api/users/:id/deactivate', (ctx) => {
    const user = ctx.db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.id))
    if (!user) throw new HttpError(404, 'User not found.')
    if (user.id === ctx.user.id) throw new HttpError(422, 'Validation failed', { id: ['You cannot deactivate your own account.'] })
    ctx.db.prepare("UPDATE users SET status = 'inactive', updated_at = ? WHERE id = ?").run(new Date().toISOString(), user.id)
    log(ctx, 'deactivated', 'Users', user)
    return ok('User deactivated successfully.', router.serializeUser(ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)))
  }, { auth: true, permission: 'users.update' })

  // POST /api/users/:id/leave — mark a user account as on leave
  router.post('/api/users/:id/leave', (ctx) => {
    const user = ctx.db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(Number(ctx.params.id))
    if (!user) throw new HttpError(404, 'User not found.')
    if (user.id === ctx.user.id) throw new HttpError(422, 'Validation failed', { id: ['You cannot put your own account on leave.'] })
    ctx.db.prepare("UPDATE users SET status = 'leave', updated_at = ? WHERE id = ?").run(new Date().toISOString(), user.id)
    log(ctx, 'left', 'Users', user)
    return ok('User marked as on leave.', router.serializeUser(ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)))
  }, { auth: true, permission: 'users.update' })

  // ---------------- Roles & permissions ----------------

  router.get('/api/roles', (ctx) => {
    const rows = ctx.db.prepare('SELECT * FROM roles ORDER BY id').all().map((r) => ({
      ...r,
      permissions: ctx.db.prepare(
        `SELECT p.id, p.name FROM permissions p
         JOIN role_permission rp ON rp.permission_id = p.id WHERE rp.role_id = ? ORDER BY p.id`,
      ).all(r.id),
      users_count: ctx.db.prepare('SELECT COUNT(*) AS c FROM role_user WHERE role_id = ?').get(r.id).c,
    }))
    return ok('Roles retrieved successfully.', { data: rows })
  }, { auth: true, permission: 'roles.view' })

  router.get('/api/roles/permissions', (ctx) => {
    const rows = ctx.db.prepare('SELECT * FROM permissions ORDER BY id').all()
    return ok('Permissions retrieved successfully.', { data: rows })
  }, { auth: true, permission: 'roles.view' })

  router.post('/api/roles', (ctx) => {
    const { name, guard_name, permission_ids } = ctx.body || {}
    if (!name) throw new HttpError(422, 'Validation failed', { name: ['The name field is required.'] })
    const taken = ctx.db.prepare('SELECT id FROM roles WHERE name = ?').get(name)
    if (taken) throw new HttpError(422, 'Validation failed', { name: ['This role name already exists.'] })

    const now = new Date().toISOString()
    const info = ctx.db.prepare('INSERT INTO roles (name, guard_name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(name, guard_name || 'web', now, now)
    const rid = Number(info.lastInsertRowid)
    if (Array.isArray(permission_ids)) {
      for (const pid of permission_ids) {
        ctx.db.prepare('INSERT INTO role_permission (role_id, permission_id) VALUES (?, ?)').run(rid, Number(pid))
      }
    }
    log(ctx, 'created', 'Roles', { id: rid, name })
    return ok('Role created successfully.', ctx.db.prepare('SELECT * FROM roles WHERE id = ?').get(rid), null, 201)
  }, { auth: true, permission: 'roles.create' })

  router.get('/api/roles/:id', (ctx) => {
    const role = ctx.db.prepare('SELECT * FROM roles WHERE id = ?').get(Number(ctx.params.id))
    if (!role) throw new HttpError(404, 'Role not found.')
    role.permissions = ctx.db.prepare(
      `SELECT p.id, p.name FROM permissions p
       JOIN role_permission rp ON rp.permission_id = p.id WHERE rp.role_id = ? ORDER BY p.id`,
    ).all(role.id)
    return ok('Role retrieved successfully.', role)
  }, { auth: true, permission: 'roles.view' })

  router.put('/api/roles/:id', (ctx) => {
    const role = ctx.db.prepare('SELECT * FROM roles WHERE id = ?').get(Number(ctx.params.id))
    if (!role) throw new HttpError(404, 'Role not found.')
    const now = new Date().toISOString()
    if (ctx.body.name && ctx.body.name !== role.name) {
      const taken = ctx.db.prepare('SELECT id FROM roles WHERE name = ? AND id != ?').get(ctx.body.name, role.id)
      if (taken) throw new HttpError(422, 'Validation failed', { name: ['This role name already exists.'] })
      ctx.db.prepare('UPDATE roles SET name = ?, updated_at = ? WHERE id = ?').run(ctx.body.name, now, role.id)
    }
    if (Array.isArray(ctx.body.permission_ids)) {
      ctx.db.prepare('DELETE FROM role_permission WHERE role_id = ?').run(role.id)
      for (const pid of ctx.body.permission_ids) {
        ctx.db.prepare('INSERT INTO role_permission (role_id, permission_id) VALUES (?, ?)').run(role.id, Number(pid))
      }
    }
    log(ctx, 'updated', 'Roles', role)
    return ok('Role updated successfully.', ctx.db.prepare('SELECT * FROM roles WHERE id = ?').get(role.id))
  }, { auth: true, permission: 'roles.update' })

  router.delete('/api/roles/:id', (ctx) => {
    const role = ctx.db.prepare('SELECT * FROM roles WHERE id = ?').get(Number(ctx.params.id))
    if (!role) throw new HttpError(404, 'Role not found.')
    if (['Super Admin', 'University Administrator'].includes(role.name)) {
      throw new HttpError(422, 'Validation failed', { id: ['System roles cannot be deleted.'] })
    }
    ctx.db.prepare('DELETE FROM role_permission WHERE role_id = ?').run(role.id)
    ctx.db.prepare('DELETE FROM role_user WHERE role_id = ?').run(role.id)
    ctx.db.prepare('DELETE FROM roles WHERE id = ?').run(role.id)
    log(ctx, 'deleted', 'Roles', role)
    return ok('Role deleted successfully.')
  }, { auth: true, permission: 'roles.delete' })
}
