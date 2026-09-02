/**
 * ---------------------------------------------------------------------------
 * ConfirmDialog — the global confirmation contract (task 1)
 * ---------------------------------------------------------------------------
 * Quasar's built-in `Dialog.create({ ok, cancel })` closes the instant OK is
 * clicked, so the request runs with no spinner and a failure cannot keep the
 * dialog open. ConfirmDialog owns its OK button instead:
 *
 *   OK → spinner + disabled → await the API → SUCCESS → emit ok → close
 *                                          → ERROR   → toast → stay open
 *
 * `q-dialog` is stubbed with a component that exposes the imperative
 * `show()`/`hide()` the Dialog plugin drives, because jsdom never runs the
 * leave transition Quasar's real dialog waits for. Everything under test — the
 * busy guard, the retry path, the error handling — is the real component code.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { Quasar } from 'quasar'
import ConfirmDialog from 'src/components/common/ConfirmDialog.vue'

vi.mock('src/utils/notify', () => {
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), apiError: vi.fn((e) => e) }
  return { notify, default: notify, tt: (k) => k }
})

import { notify } from 'src/utils/notify'
import i18n from 'src/i18n'

/** Stand-in for <q-dialog>: renders its slot and records show()/hide(). */
const QDialogStub = defineComponent({
  name: 'QDialog',
  emits: ['hide'],
  setup(props, { slots, expose }) {
    const state = { shown: false, hidden: false }
    expose({
      show: () => { state.shown = true },
      hide: () => { state.hidden = true },
      state,
    })
    return () => h('div', { class: 'dialog-stub' }, slots.default ? slots.default() : [])
  },
})

function mountDialog(props = {}) {
  const w = mount(ConfirmDialog, {
    props: {
      title: 'Delete employee?',
      message: 'This action cannot be undone.',
      okLabel: 'Delete',
      busyLabel: 'Deleting…',
      cancelLabel: 'Cancel',
      ...props,
    },
    global: {
      plugins: [[Quasar, { plugins: {} }], i18n],
      stubs: { QDialog: QDialogStub },
    },
    attachTo: document.body,
  })
  return w
}

const okButton = (w) => w.find('[data-cy="confirm-ok"]')
const cancelButton = (w) => w.find('[data-cy="confirm-cancel"]')
const dialogState = (w) => w.findComponent(QDialogStub).vm.state

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ConfirmDialog — rendering', () => {
  it('shows the title, message and both labels', () => {
    const w = mountDialog()
    expect(w.text()).toContain('Delete employee?')
    expect(w.text()).toContain('This action cannot be undone.')
    expect(okButton(w).text()).toContain('Delete')
    expect(cancelButton(w).text()).toContain('Cancel')
  })

  it('renders the optional detail line and honours a custom colour', () => {
    const w = mountDialog({ detail: 'Asset KU-IT-2026-000001', color: 'warning' })
    expect(w.text()).toContain('Asset KU-IT-2026-000001')
    expect(w.find('.ku-confirm__icon').classes().some((c) => c.includes('warning'))).toBe(true)
  })
})

describe('ConfirmDialog — cancel', () => {
  it('hides without running the work', async () => {
    const onConfirm = vi.fn()
    const w = mountDialog({ onConfirm })

    await cancelButton(w).trigger('click')
    await flushPromises()

    expect(dialogState(w).hidden).toBe(true)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(notify.apiError).not.toHaveBeenCalled()
  })
})

describe('ConfirmDialog — success path', () => {
  it('closes immediately when there is no async work', async () => {
    const w = mountDialog()
    await okButton(w).trigger('click')
    await flushPromises()

    expect(w.emitted('ok')).toBeTruthy()
    expect(dialogState(w).hidden).toBe(true)
  })

  it('awaits the request, shows the busy label, then emits ok with the result', async () => {
    let release
    const onConfirm = vi.fn(() => new Promise((r) => { release = r }))
    const onConfirmed = vi.fn()
    const w = mountDialog({ onConfirm, onConfirmed })

    await okButton(w).trigger('click')
    await flushPromises()

    // In flight: spinner label, dialog still open, nothing emitted yet.
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(okButton(w).text()).toContain('Deleting…')
    expect(w.emitted('ok')).toBeFalsy()
    expect(dialogState(w).hidden).toBe(false)

    release({ id: 7 })
    await flushPromises()

    expect(onConfirmed).toHaveBeenCalledWith({ id: 7 })
    expect(w.emitted('ok')[0]).toEqual([{ id: 7 }])
    expect(dialogState(w).hidden).toBe(true)
  })

  it('emits `true` when the work returns nothing', async () => {
    const w = mountDialog({ onConfirm: async () => {} })
    await okButton(w).trigger('click')
    await flushPromises()
    expect(w.emitted('ok')[0]).toEqual([true])
  })
})

describe('ConfirmDialog — duplicate submission guard', () => {
  it('ignores further clicks while the request is in flight', async () => {
    let release
    const onConfirm = vi.fn(() => new Promise((r) => { release = r }))
    const w = mountDialog({ onConfirm })

    await okButton(w).trigger('click')
    await okButton(w).trigger('click')
    await okButton(w).trigger('click')
    await flushPromises()

    expect(onConfirm).toHaveBeenCalledTimes(1)

    release()
    await flushPromises()
    expect(w.emitted('ok')).toHaveLength(1)
  })

  it('cannot be cancelled mid-flight', async () => {
    let release
    const w = mountDialog({ onConfirm: () => new Promise((r) => { release = r }) })

    await okButton(w).trigger('click')
    await flushPromises()
    expect(cancelButton(w).attributes('disabled')).toBeDefined()

    release()
    await flushPromises()
  })
})

describe('ConfirmDialog — failure path', () => {
  const rejection = () => Promise.reject(Object.assign(new Error('This role is in use.'), { status: 409 }))

  it('stays open, does not emit ok, and reports through the shared error layer', async () => {
    const onConfirmed = vi.fn()
    const w = mountDialog({ onConfirm: rejection, onConfirmed, errorMessage: 'Unable to delete the role.' })

    await okButton(w).trigger('click')
    await flushPromises()

    expect(w.emitted('ok')).toBeFalsy()
    expect(dialogState(w).hidden).toBe(false)
    expect(onConfirmed).not.toHaveBeenCalled()
    expect(notify.apiError).toHaveBeenCalledTimes(1)
    expect(notify.apiError.mock.calls[0][1]).toEqual({ fallback: 'Unable to delete the role.' })
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('restores the button so the user can retry or back out', async () => {
    const w = mountDialog({ onConfirm: rejection })

    await okButton(w).trigger('click')
    await flushPromises()

    expect(okButton(w).text()).toContain('Delete')
    expect(okButton(w).text()).not.toContain('Deleting…')
    expect(cancelButton(w).attributes('disabled')).toBeUndefined()
  })

  it('can be retried and then succeeds', async () => {
    let attempt = 0
    const onConfirm = vi.fn(() => (++attempt === 1 ? rejection() : Promise.resolve({ ok: 1 })))
    const w = mountDialog({ onConfirm })

    await okButton(w).trigger('click')
    await flushPromises()
    expect(w.emitted('ok')).toBeFalsy()

    await okButton(w).trigger('click')
    await flushPromises()

    expect(onConfirm).toHaveBeenCalledTimes(2)
    expect(w.emitted('ok')[0]).toEqual([{ ok: 1 }])
  })
})
