/**
 * ---------------------------------------------------------------------------
 * useAction — the shared Create/Edit/Update/Delete/Assign/Submit lifecycle
 * ---------------------------------------------------------------------------
 * These tests pin down the behaviour every page relies on:
 *   1. a pending flag that guards against duplicate submissions,
 *   2. success notification → onSuccess (close dialog / refresh table),
 *   3. failure → notification + field errors and NO onSuccess (dialog stays
 *      open, user data preserved).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useAction } from 'src/composables/useAction'
import { notify } from 'src/utils/notify'

beforeEach(() => {
  vi.spyOn(notify, 'success').mockReturnValue(null)
  vi.spyOn(notify, 'error').mockReturnValue(null)
  vi.spyOn(notify, 'apiError').mockImplementation((err) => err)
})

afterEach(() => {
  vi.restoreAllMocks()
})

const validationError = () =>
  Object.assign(new Error('Validation failed'), {
    status: 422,
    errors: {
      employee_id: ['The employee field is required.'],
      asset_id: ['The selected asset is already assigned.', 'Second message.'],
    },
  })

describe('useAction — loading state & duplicate guard', () => {
  it('is not pending before or after a run', async () => {
    const action = useAction()
    expect(action.pending.value).toBe(false)
    await action.run(async () => ({ id: 1 }))
    expect(action.pending.value).toBe(false)
  })

  it('is pending for exactly the duration of the request', async () => {
    const action = useAction()
    let resolveTask
    const task = () => new Promise((r) => { resolveTask = r })

    const promise = action.run(task, { successMessage: 'done' })
    await nextTick()
    expect(action.pending.value).toBe(true)
    expect(action.isSubmitting.value).toBe(true)

    resolveTask({ ok: true })
    await promise
    expect(action.pending.value).toBe(false)
  })

  it('ignores a second submission while the first is in flight', async () => {
    const action = useAction()
    const task = vi.fn(() => new Promise((r) => setTimeout(() => r({ id: 1 }), 0)))

    const first = action.run(task, { successMessage: '✓ Created.' })
    await nextTick()
    const second = await action.run(task, { successMessage: '✓ Created.' })

    expect(second).toEqual({ ok: false, skipped: true })
    expect(task).toHaveBeenCalledTimes(1)

    await first
    expect(notify.success).toHaveBeenCalledTimes(1)
  })
})

describe('useAction — success path', () => {
  it('notifies with the specific message, then runs onSuccess', async () => {
    const action = useAction()
    const order = []
    notify.success.mockImplementation((m) => order.push(`notify:${m}`))

    const result = await action.run(async () => ({ data: { id: 7 } }), {
      successMessage: '✓ Employee created successfully.',
      onSuccess: () => { order.push('close+refresh') },
    })

    expect(result.ok).toBe(true)
    expect(result.result).toEqual({ data: { id: 7 } })
    // The toast must fire BEFORE the dialog closes / table refreshes.
    expect(order).toEqual(['notify:✓ Employee created successfully.', 'close+refresh'])
  })

  it('supports a message builder receiving the API result', async () => {
    const action = useAction()
    await action.run(async () => ({ data: { asset_code: 'AST-042' } }), {
      successMessage: ({ result }) => `✓ ${result.data.asset_code} assigned successfully.`,
    })
    expect(notify.success).toHaveBeenCalledWith('✓ AST-042 assigned successfully.', undefined)
  })

  it('stays silent when asked to', async () => {
    const action = useAction()
    await action.run(async () => ({}), { successMessage: 'nope', silent: true })
    expect(notify.success).not.toHaveBeenCalled()
  })
})

describe('useAction — failure path', () => {
  it('keeps the dialog open: no onSuccess, error notification shown', async () => {
    const action = useAction()
    const onSuccess = vi.fn()
    const onError = vi.fn()

    const result = await action.run(async () => { throw validationError() }, {
      successMessage: '✓ Saved.',
      errorMessage: 'Unable to save the assignment.',
      onSuccess,
      onError,
    })

    expect(result.ok).toBe(false)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(notify.success).not.toHaveBeenCalled()
    expect(notify.apiError).toHaveBeenCalledTimes(1)
    expect(action.pending.value).toBe(false)
  })

  it('maps server validation messages onto fieldErrors (first message wins)', async () => {
    const action = useAction()
    await action.run(async () => { throw validationError() }, { errorMessage: 'x' })

    expect(action.fieldErrors.employee_id).toBe('The employee field is required.')
    expect(action.fieldErrors.asset_id).toBe('The selected asset is already assigned.')
    expect(action.lastError.value.isValidation).toBe(true)
    expect(action.lastError.value.status).toBe(422)
  })

  it('respects an errorFields whitelist', async () => {
    const action = useAction()
    await action.run(async () => { throw validationError() }, {
      errorMessage: 'x',
      errorFields: ['employee_id'],
    })

    expect(action.fieldErrors.employee_id).toBe('The employee field is required.')
    expect(action.fieldErrors.asset_id).toBeUndefined()
  })

  it('clears stale field errors at the start of the next attempt', async () => {
    const action = useAction()
    await action.run(async () => { throw validationError() }, { errorMessage: 'x' })
    expect(Object.keys(action.fieldErrors)).toHaveLength(2)

    await action.run(async () => ({ id: 1 }), { successMessage: '✓ ok' })
    expect(Object.keys(action.fieldErrors)).toHaveLength(0)
  })

  it('clearFieldErrors() empties the map', async () => {
    const action = useAction()
    await action.run(async () => { throw validationError() }, { errorMessage: 'x' })
    action.clearFieldErrors()
    expect(Object.keys(action.fieldErrors)).toHaveLength(0)
  })

  it('normalises a plain network failure', async () => {
    const action = useAction()
    const result = await action.run(async () => { throw new Error('Network Error') }, { errorMessage: 'Cannot reach the server.' })

    expect(result.ok).toBe(false)
    expect(action.lastError.value.isNetwork).toBe(true)
    expect(Object.keys(action.fieldErrors)).toHaveLength(0)
  })
})
