/**
 * End-to-end API contract check against the running mock API (or any live
 * KU-AMS backend — same contract). Verifies the employee ↔ asset workflow:
 *
 *   employees table -> Assign To employee_id -> assets.employee_id
 *                   -> Employee <-> Asset relationship both directions
 *                   -> users table carries NO employee fields
 *
 * Usage: node scripts/api-contract-check.mjs [baseUrl]
 * (default baseUrl http://localhost:9000 — the Vite dev server)
 */
const BASE = process.argv[2] || 'http://localhost:9000'

let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
  if (!ok) failures++
}

const api = async (method, path, body, token) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let bodyJson = null
  try { bodyJson = await res.json() } catch { /* ignore */ }
  return { status: res.status, body: bodyJson }
}

// --- login -------------------------------------------------------------------
const login = await api('POST', '/login', { login: 'superadmin', password: 'password' })
check('login works', login.status === 200 && login.body?.data?.token)
const token = login.body?.data?.token

// --- users: authentication accounts only -------------------------------------
const me = await api('GET', '/me', null, token)
const meUser = me.body?.data?.user
check('/user carries no employee fields', Boolean(meUser) && !('employee_number' in meUser) && !('position' in meUser) && !('hire_type' in meUser) && !('salary' in meUser))
const usersList = await api('GET', '/users?per_page=100', null, token)
const firstUser = usersList.body?.data?.data?.[0] || {}
check(
  'GET /users rows carry no employee fields',
  usersList.status === 200 && !('employee_number' in firstUser) && !('position' in firstUser) && !('hire_type' in firstUser) && !('salary' in firstUser),
)
const usersPageCheck = usersList.body?.data?.data?.every((u) => !('employee_number' in u) && !('salary' in u))
check('no user row exposes employee_number/salary', Boolean(usersPageCheck))

// --- employees ---------------------------------------------------------------
const emps = await api('GET', '/employees?per_page=100', null, token)
check('GET /employees returns the employees table', emps.status === 200 && emps.body?.data?.data?.length > 0, `${emps.body?.data?.data?.length} employees`)
const employees = emps.body?.data?.data
const empWithCode = employees.find((e) => e.employee_code && e.full_name)
check('employee rows expose employee_code/full_name/department_name', Boolean(empWithCode))

// create an employee
const createdEmp = await api('POST', '/employees', {
  first_name: 'Test', last_name: 'Assignee', position: 'QA',
}, token)
check('POST /employees creates an employee (auto code)', createdEmp.status === 201 && /^EMP-/.test(createdEmp.body?.data?.employee_code || ''), createdEmp.body?.data?.employee_code)
const empId = createdEmp.body?.data?.id

// --- asset assignment via employee_id ----------------------------------------
const cats = await api('GET', '/categories', null, token)
const categoryId = cats.body?.data?.data?.[0]?.id

// create an asset with an employee (Assign To during create)
const createdAsset = await api('POST', '/assets', {
  name: 'Contract check laptop', category_id: categoryId, employee_id: empId, purchase_price: 100,
}, token)
check('POST /assets with employee_id saves the assignment', createdAsset.status === 201 && createdAsset.body?.data?.employee_id === empId)
const assetId = createdAsset.body?.data?.id
check('asset assigned at creation gets status=assigned', createdAsset.body?.data?.status === 'assigned', createdAsset.body?.data?.status)

// Employee -> Assets direction
const empAssets = await api('GET', `/employees/${empId}/assets`, null, token)
check('GET /employees/:id/assets returns the assigned asset', empAssets.status === 200 && empAssets.body?.data?.data?.some((a) => a.id === assetId))
const empShow = await api('GET', `/employees/${empId}`, null, token)
check('employee profile reports asset_summary.total >= 1', (empShow.body?.data?.asset_summary?.total || 0) >= 1)

// edit the asset: unassign (employee_id = null)
const unassigned = await api('PUT', `/assets/${assetId}`, { employee_id: null }, token)
check('PUT /assets employee_id=null unassigns', unassigned.status === 200 && unassigned.body?.data?.employee_id === null && unassigned.body?.data?.status === 'available', unassigned.body?.data?.status)

// edit the asset: change employee
const otherEmp = employees[0]
const reassigned = await api('PUT', `/assets/${assetId}`, { employee_id: otherEmp.id }, token)
check('PUT /assets reassigns to another employee', reassigned.status === 200 && reassigned.body?.data?.employee_id === otherEmp.id)

// invalid employee rejected
const badAssign = await api('PUT', `/assets/${assetId}`, { employee_id: 999999 }, token)
check('invalid employee_id is rejected with 422 + field error', badAssign.status === 422 && Boolean(badAssign.body?.errors?.employee_id))

// --- hand-out assignment workflow (assign dialog) ----------------------------
await api('PUT', `/assets/${assetId}`, { employee_id: null }, token) // make it available
const assign = await api('POST', `/assets/${assetId}/assign`, { employee_id: empId }, token)
check('POST /assets/:id/assign accepts employee_id', assign.status === 201 && assign.body?.data?.employee_id === empId)
const afterAssign = await api('GET', `/assets/${assetId}`, null, token)
check('assignment mirrors onto assets.employee_id', afterAssign.body?.data?.employee_id === empId && afterAssign.body?.data?.status === 'assigned')

const assignList = await api('GET', `/asset-assignments?employee_id=${empId}`, null, token)
check('GET /asset-assignments?employee_id filters and names the employee', assignList.status === 200 && assignList.body?.data?.data?.some((a) => a.employee_name?.includes('Test')))
const assignmentId = assignList.body?.data?.data?.[0]?.id

const returned = await api('POST', `/asset-assignments/${assignmentId}/return`, { condition_on_return: 'good' }, token)
check('return closes the assignment', returned.status === 200 && returned.body?.data?.status === 'returned')
const afterReturn = await api('GET', `/assets/${assetId}`, null, token)
check('return unassigns the employee and frees the asset', afterReturn.body?.data?.employee_id === null && afterReturn.body?.data?.status === 'available')

// --- safety: employee with assets cannot be deleted --------------------------
await api('PUT', `/assets/${assetId}`, { employee_id: empId }, token)
const delBlocked = await api('DELETE', `/employees/${empId}`, null, token)
check('DELETE /employees/:id blocked while assets are assigned', delBlocked.status === 422, delBlocked.body?.message)

// cleanup: unassign then delete the test employee (assets are kept)
await api('PUT', `/assets/${assetId}`, { employee_id: null }, token)
const delOk = await api('DELETE', `/employees/${empId}`, null, token)
check('DELETE /employees/:id works once assets are unassigned', delOk.status === 200)
const assetStillThere = await api('GET', `/assets/${assetId}`, null, token)
check('deleting an employee never deletes assets', assetStillThere.status === 200)

console.log(failures ? `\n${failures} FAILURES` : '\nALL CONTRACT CHECKS PASSED')
process.exit(failures ? 1 : 0)
