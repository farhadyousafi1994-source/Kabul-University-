import { computed, reactive, ref, unref } from 'vue'
import { useAction } from './useAction'
import { confirmDelete } from 'src/utils/confirm'
import { notify } from 'src/utils/notify'

/**
 * ---------------------------------------------------------------------------
 * useCrudForm — reusable Create / Edit / Delete dialog controller
 * ---------------------------------------------------------------------------
 *
 * Every page that owns a create-or-edit dialog follows exactly the same
 * lifecycle, so it is implemented here once and reused everywhere:
 *
 *   Create → submit → backend success → ✓ notify → dialog closes → form resets → list refreshes
 *   Edit   → submit → backend success → ✓ notify → dialog closes → list refreshes
 *   Delete → confirm → backend success → ✓ notify → confirm closes → list refreshes
 *   any    → backend failure → ✕ notify + inline field errors → dialog STAYS open
 *
 * Example
 * -------
 *   const crud = useCrudForm({
 *     entity: () => t('common.entities.employee'),
 *     defaults: () => ({ first_name: '', last_name: '' }),
 *     create: (payload) => employeeService.create(payload),
 *     update: (id, payload) => employeeService.update(id, payload),
 *     remove: (id) => employeeService.remove(id),
 *     fromRow: (row) => ({ first_name: row.first_name, last_name: row.last_name }),
 *     onSaved: () => Promise.all([load(), loadStats()]),
 *     onRemoved: load,
 *   })
 */
export function useCrudForm(options = {}) {
  const {
    entity,
    defaults = {},
    create,
    update,
    remove,
    fromRow,
    toPayload,
    onSaved,
    onRemoved,
    onOpened,
    onClosed,
    errorFields,
    messages = {},
    deleteVerb = 'delete',
    rowLabel,
    deleteTitle,
    deleteMessage,
  } = options

  const dialogOpen = ref(false)
  const editing = ref(null)
  const form = reactive({})
  const action = useAction()

  const isEditing = computed(() => Boolean(editing.value))
  const saving = action.pending
  const fieldErrors = action.fieldErrors

  /** Entity name used in the toasts — may be a function so it stays translated. */
  const entityName = computed(() => {
    const value = typeof entity === 'function' ? entity() : unref(entity)
    return value || 'record'
  })

  function fillForm(source) {
    for (const key of Object.keys(form)) delete form[key]
    Object.assign(form, source || {})
  }

  function resolveDefaults() {
    const base = typeof defaults === 'function' ? defaults() : unref(defaults)
    return base ? { ...base } : {}
  }

  function openCreate() {
    editing.value = null
    action.clearFieldErrors()
    fillForm(resolveDefaults())
    dialogOpen.value = true
    onOpened?.(null, form)
  }

  function openEdit(row) {
    editing.value = row
    action.clearFieldErrors()
    fillForm(fromRow ? fromRow(row) : { ...row })
    dialogOpen.value = true
    onOpened?.(row, form)
  }

  function closeDialog() {
    dialogOpen.value = false
    onClosed?.()
  }

  /** Clear temporary form state (validation errors, edits in progress). */
  function resetForm() {
    editing.value = null
    action.clearFieldErrors()
    fillForm(resolveDefaults())
  }

  function buildPayload() {
    const snapshot = { ...form }
    return toPayload ? toPayload(snapshot, editing.value) : snapshot
  }

  function labelFor(row) {
    if (!row) return ''
    if (typeof rowLabel === 'function') return rowLabel(row)
    if (typeof rowLabel === 'string') return row[rowLabel] ?? ''
    return row.name || row.title || row.full_name || row.label || `#${row.id ?? ''}`
  }

  /**
   * Submit the current form. Resolves `{ ok, result }`; `ok` is true only once
   * the backend has confirmed the write, the success toast has been shown and
   * the list has been refreshed.
   */
  async function submit(overrides = {}) {
    const wasEditing = isEditing.value
    const id = editing.value?.id
    const data = buildPayload()

    return action.run(() => (wasEditing ? update(id, data) : create(data)), {
      successMessage: () =>
        (wasEditing ? messages.updated : messages.created)
          ? (wasEditing ? messages.updated : messages.created)(entityName.value)
          : notify[wasEditing ? 'updated' : 'created'](entityName.value),
      onSuccess: async (result) => {
        closeDialog()
        if (!wasEditing) resetForm()
        await onSaved?.(result, { editing: wasEditing, id, payload: data })
      },
      errorFields,
      ...overrides,
    })
  }

  const deleting = ref(false)
  const deletingId = ref(null)

  /** Confirmation dialog + delete request with the standard lifecycle. */
  async function confirmRemove(row, overrides = {}) {
    if (!row || typeof remove !== 'function') return { ok: false, skipped: true }
    const id = row.id ?? row

    const ok = await confirmDelete({
      entity: entityName.value,
      name: labelFor(row),
      verb: deleteVerb,
      title: overrides.title || deleteTitle,
      message: overrides.message || deleteMessage,
      okLabel: overrides.okLabel,
      onConfirm: async () => {
        deletingId.value = id
        deleting.value = true
        try {
          return await remove(id, row)
        } finally {
          deleting.value = false
          deletingId.value = null
        }
      },
      onConfirmed: async () => {
        notify.success(
          (deleteVerb === 'archive' ? notify.archived : notify.deleted)(entityName.value),
        )
        await onRemoved?.(row)
      },
    })

    return { ok }
  }

  return {
    // dialog / form state
    dialogOpen,
    editing,
    isEditing,
    entityName,
    form,
    // action state
    saving,
    pending: action.pending,
    isSubmitting: action.isSubmitting,
    fieldErrors,
    lastError: action.lastError,
    clearFieldErrors: action.clearFieldErrors,
    applyFieldErrors: action.applyFieldErrors,
    // lifecycle
    openCreate,
    openEdit,
    closeDialog,
    resetForm,
    submit,
    run: action.run,
    labelFor,
    // delete
    deleting,
    deletingId,
    confirmRemove,
  }
}

export default useCrudForm
