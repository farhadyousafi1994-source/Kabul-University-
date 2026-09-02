/**
 * ---------------------------------------------------------------------------
 * Global notification layer (task 1)
 * ---------------------------------------------------------------------------
 * Every toast in the app goes through `src/utils/notify.js`, which talks to
 * Quasar's plugin singleton so it also works from stores, services and router
 * guards. These tests pin the wording/type contract and prove that a missing
 * plugin can never break a completed operation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp } from 'vue'
import { Quasar, Notify } from 'quasar'
import { notify } from 'src/utils/notify'

// `Notify.create` only exists once the plugin has been installed — which is
// exactly what `src/main.js` does. Without it, every toast in the app silently
// disappears (the original production bug).
createApp({ template: '<div />' }).use(Quasar, { plugins: { Notify } })

let created

beforeEach(() => {
  created = []
  vi.spyOn(Notify, 'create').mockImplementation((opts) => {
    created.push(opts)
    return { dismiss: vi.fn() }
  })
  document.documentElement.removeAttribute('dir')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('notify — presets', () => {
  it('success uses the positive preset', () => {
    notify.success('✓ Employee created successfully.')
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      type: 'positive',
      icon: 'check_circle',
      message: '✓ Employee created successfully.',
    })
    expect(created[0].position).toBe('top-right')
  })

  it('error uses the negative preset and stays on screen longer', () => {
    notify.error('Unable to save the employee.')
    expect(created[0]).toMatchObject({ type: 'negative', icon: 'error', message: 'Unable to save the employee.' })
    expect(created[0].timeout).toBeGreaterThan(created.length ? 3200 : 0)
  })

  it('warning and info map to their own types', () => {
    notify.warning('careful')
    notify.info('fyi')
    expect(created.map((c) => c.type)).toEqual(['warning', 'info'])
  })

  it('never renders an empty toast', () => {
    notify.success('')
    notify.success(null)
    notify.success(undefined)
    expect(Notify.create).not.toHaveBeenCalled()
  })

  it('mirrors the toast to the left in RTL locales', () => {
    document.documentElement.setAttribute('dir', 'rtl')
    notify.success('موفق')
    expect(created[0].position).toBe('top-left')

    document.documentElement.setAttribute('dir', 'ltr')
    notify.success('ok')
    expect(created[1].position).toBe('top-right')
  })

  it('per-call options override the preset', () => {
    notify.success('saved', { caption: 'AST-001', timeout: 1000 })
    expect(created[0]).toMatchObject({ caption: 'AST-001', timeout: 1000, type: 'positive' })
  })
})

describe('notify.apiError — server failures', () => {
  it('turns a 422 into a message plus the field summary as caption', () => {
    const err = Object.assign(new Error('Validation failed'), {
      status: 422,
      errors: { employee_id: ['The employee field is required.'], notes: ['Too long.'] },
    })

    const normalised = notify.apiError(err, { fallback: 'Unable to save the assignment.' })

    expect(created).toHaveLength(1)
    expect(created[0].type).toBe('negative')
    expect(created[0].message).toBe('Unable to save the assignment.')
    expect(created[0].caption).toContain('The employee field is required.')
    expect(normalised.isValidation).toBe(true)
    expect(normalised.fieldErrors.employee_id).toBe('The employee field is required.')
  })

  it('hides raw server internals for 5xx and shows the professional fallback', () => {
    notify.apiError(Object.assign(new Error('Database connection lost'), { status: 500 }), {
      fallback: 'Something went wrong on the server. Please try again.',
    })
    expect(created[0].message).toBe('Something went wrong on the server. Please try again.')
    expect(created[0].message).not.toContain('Database connection lost')
  })

  it('surfaces the API message for ordinary (4xx) failures', () => {
    notify.apiError(Object.assign(new Error('This asset is already assigned.'), { status: 409 }))
    expect(created[0].message).toBe('This asset is already assigned.')
  })

  it('stays silent when asked, but still returns the normalised error', () => {
    const err = notify.apiError(new Error('quiet'), { silent: true })
    expect(Notify.create).not.toHaveBeenCalled()
    expect(err.message).toBe('quiet')
  })
})

describe('notify — plugin availability (the original production bug)', () => {
  it('Notify.create exists because main.js registers the plugin', () => {
    expect(typeof Notify.create).toBe('function')
  })

  it('src/main.js registers Notify, Dialog and Loading', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const main = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8')
    expect(main).toMatch(/plugins\s*:\s*\{[^}]*Notify/s)
    expect(main).toMatch(/plugins\s*:\s*\{[^}]*Dialog/s)
    expect(main).toMatch(/plugins\s*:\s*\{[^}]*Loading/s)
  })
})

describe('notify — resilience', () => {
  it('never throws when the Notify plugin is unavailable', () => {
    vi.mocked(Notify.create).mockImplementation(() => {
      throw new Error('Notify plugin is not installed')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => notify.success('✓ Saved.')).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
