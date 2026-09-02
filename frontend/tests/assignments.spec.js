/**
 * ---------------------------------------------------------------------------
 * Module 8 — Asset assignment flow (the bug report in task 2)
 * ---------------------------------------------------------------------------
 * "Assign Asset" must: open the dialog → load ASSETS (available ones, labelled
 * `AST-001 — Dell Latitude Laptop`) and EMPLOYEES from the dedicated
 * `employees` table (labelled `EMP-001 — Name`, value = employee id) → submit
 * `POST /assets/{id}/assign` → on success notify + close + refresh, and on
 * failure stay open with the server's field errors.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Quasar, QDialog, QForm, QSelect } from 'quasar'
import i18n from 'src/i18n'

const listResponse = vi.fn()
const assignMock = vi.fn()
const returnMock = vi.fn()
const assetListMock = vi.fn()
const employeeListMock = vi.fn()

vi.mock('src/services/operations.service', () => ({
  assignmentService: {
    list: (...args) => listResponse(...args),
    assign: (...args) => assignMock(...args),
    returnAsset: (...args) => returnMock(...args),
    get: vi.fn(),
  },
}))

vi.mock('src/services/assets.service', () => ({
  assetService: { list: (...args) => assetListMock(...args) },
}))

vi.mock('src/services/employees.service', () => ({
  employeeService: {
    list: (...args) => employeeListMock(...args),
    get: vi.fn(async () => ({ data: { id: 4, employee_code: 'EMP-004', first_name: 'Sara', last_name: 'Karimi' } })),
  },
}))

vi.mock('src/utils/notify', () => {
  const notify = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    apiError: vi.fn((err) => err),
    created: vi.fn(),
    updated: vi.fn(),
    deleted: vi.fn(),
    archived: vi.fn(),
    saved: vi.fn(),
    assigned: vi.fn(),
    unassigned: vi.fn(),
  }
  return { notify, default: notify, tt: (k) => k }
})

import { useAuthStore } from 'src/stores/auth'
import { notify } from 'src/utils/notify'
import AssignmentsPage from 'src/pages/Assets/AssignmentsPage.vue'

const ASSETS = [
  { id: 9, asset_code: 'AST-001', name: 'Dell Latitude Laptop', brand: 'Dell', status: 'available', department_name: 'IT' },
  { id: 10, asset_code: 'AST-002', name: 'HP LaserJet Printer', brand: 'HP', status: 'assigned', department_name: 'Finance' },
  { id: 11, asset_code: 'AST-003', name: 'Projector', brand: 'Epson', status: 'available' },
]

const EMPLOYEES = [
  { id: 4, employee_code: 'EMP-004', first_name: 'Sara', last_name: 'Karimi', status: 'active' },
  { id: 5, employee_code: 'EMP-005', first_name: 'Omid', last_name: 'Rahimi', status: 'active' },
]

/**
 * `roles` / `permissions` are getters derived from `auth.user`, so the fixture
 * has to be shaped exactly like the API's `/me` payload.
 */
function mountPage({ role = 'Super Admin', permissions = [] } = {}) {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.user = {
    id: 1,
    name: 'Asset Manager',
    username: 'manager',
    roles: [{ name: role, permissions: permissions.map((name) => ({ name })) }],
    permissions,
  }
  auth.token = 'test-token'

  return mount(AssignmentsPage, {
    global: { plugins: [[Quasar, { plugins: {} }], i18n], stubs: { routerLink: true } },
    attachTo: document.body,
  })
}

/** The toolbar filter bar also has an "Assigned To" select — scope to the dialog. */
function openDialog(w) {
  return w.findAllComponents(QDialog).find((d) => d.props('modelValue') === true)
}

function dialogSelect(w, labelMatch) {
  const dialog = openDialog(w)
  expect(dialog, 'a dialog must be open').toBeTruthy()
  const select = dialog.findAllComponents(QSelect).find((s) => labelMatch.test(String(s.props('label') || '')))
  expect(select, `dialog select matching ${labelMatch} must exist`).toBeTruthy()
  return select
}

/** Open the Assign dialog through the real toolbar button. */
async function openAssignDialog(w) {
  const assignBtn = w.findAll('button.ab-btn').find((b) => /Assign/i.test(b.text()))
  expect(assignBtn, 'the "Assign Asset" toolbar button must exist').toBeTruthy()
  await assignBtn.trigger('click')
  await flushPromises()
  return openDialog(w)
}

async function pickSelect(w, labelMatch, value) {
  const select = dialogSelect(w, labelMatch)
  select.vm.$emit('update:modelValue', value)
  await flushPromises()
  return select
}

/** QForm re-emits `submit` after its own validation passes. */
async function submitAssignForm(w) {
  const form = openDialog(w).findAllComponents(QForm)[0]
  form.vm.$emit('submit', { preventDefault() {}, stopPropagation() {} })
  await flushPromises()
  return form
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  listResponse.mockResolvedValue({ data: { data: [], meta: { total: 0, last_page: 1 } } })
  assetListMock.mockResolvedValue({ data: { data: ASSETS, meta: { total: 3, last_page: 1 } } })
  employeeListMock.mockResolvedValue({ data: { data: EMPLOYEES, meta: { total: 2, last_page: 1 } } })
  assignMock.mockResolvedValue({ data: { id: 1, status: 'active' } })
  returnMock.mockResolvedValue({ data: { id: 1, status: 'returned' } })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AssignmentsPage — Assign Asset flow', () => {
  it('opens the dialog from the toolbar and loads assets + employees', async () => {
    const w = mountPage()
    await flushPromises()

    const dialog = await openAssignDialog(w)
    expect(dialog, 'the assign dialog must be open').toBeTruthy()

    // Assets come from the assets API, labelled `CODE — Name`.
    expect(assetListMock).toHaveBeenCalled()
    const assetSelect = dialogSelect(w, /Asset/i)
    const labels = assetSelect.props('options').map((o) => o.label)
    expect(labels).toContain('AST-001 — Dell Latitude Laptop')

    // An already-assigned asset is visible but not selectable.
    const assigned = assetSelect.props('options').find((o) => o.value === 10)
    expect(assigned.disable).toBe(true)
    const available = assetSelect.props('options').find((o) => o.value === 9)
    expect(available.disable).toBe(false)

    // Employees come from the dedicated `employees` table (never `users`).
    expect(employeeListMock).toHaveBeenCalled()
    const employeeSelect = dialogSelect(w, /Assigned To/i)
    const empOptions = employeeSelect.props('options')
    expect(empOptions.map((o) => o.label)).toContain('EMP-004 — Sara Karimi')
    expect(empOptions.find((o) => o.label === 'EMP-004 — Sara Karimi').value).toBe(4)
  })

  it('submits POST /assets/{id}/assign, then notifies, closes and refreshes', async () => {
    const w = mountPage()
    await flushPromises()
    listResponse.mockClear()

    await openAssignDialog(w)
    await pickSelect(w, /Asset/i, 9)
    await pickSelect(w, /Assigned To/i, 4)
    await submitAssignForm(w)

    expect(assignMock).toHaveBeenCalledTimes(1)
    const [assetId, payload] = assignMock.mock.calls[0]
    expect(assetId).toBe(9)
    expect(payload.employee_id).toBe(4)

    // ✓ specific success message — never a bare "Success"
    expect(notify.success).toHaveBeenCalledTimes(1)
    expect(notify.success.mock.calls[0][0]).toMatch(/assigned successfully/i)

    // Dialog closed and the table refreshed after the confirmed write.
    expect(openDialog(w), 'dialog must close after a confirmed write').toBeFalsy()
    // listResponse was cleared after the initial page load, so this single call
    // is the post-save refresh.
    expect(listResponse).toHaveBeenCalledTimes(1)
  })

  it('does not call the API when required fields are empty', async () => {
    const w = mountPage()
    await flushPromises()
    await openAssignDialog(w)
    await submitAssignForm(w)

    expect(assignMock).not.toHaveBeenCalled()
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('keeps the dialog open with field errors when the API rejects', async () => {
    const w = mountPage()
    await flushPromises()

    // A complete form that the server still refuses (e.g. the asset was taken
    // by someone else a second ago) — client validation passes, the API rejects.
    assignMock.mockRejectedValueOnce(
      Object.assign(new Error('Validation failed'), {
        status: 422,
        errors: { employee_id: ['The selected employee already holds this asset.'] },
      }),
    )

    await openAssignDialog(w)
    await pickSelect(w, /Asset/i, 9)
    await pickSelect(w, /Assigned To/i, 4)
    await submitAssignForm(w)

    expect(assignMock).toHaveBeenCalledTimes(1)
    expect(notify.success).not.toHaveBeenCalled()
    expect(notify.apiError).toHaveBeenCalledTimes(1)

    // The dialog is still open and the asset the user chose is still selected.
    const dialog = openDialog(w)
    expect(dialog, 'dialog must stay open after a failed submit').toBeTruthy()
    expect(dialogSelect(w, /Asset/i).props('modelValue')).toBe(9)
    expect(dialogSelect(w, /Assigned To/i).props('modelValue')).toBe(4)
  })

  it('shows no Assign button without the assets.assign permission', async () => {
    const w = mountPage({ role: 'Auditor', permissions: ['assets.view'] })
    await flushPromises()

    const assignBtn = w.findAll('button.ab-btn').find((b) => /Assign/i.test(b.text()))
    expect(assignBtn).toBeFalsy()
  })
})
