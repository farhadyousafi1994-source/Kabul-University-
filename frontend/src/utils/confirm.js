import { Dialog } from 'quasar'
import ConfirmDialog from 'src/components/common/ConfirmDialog.vue'
import PromptDialog from 'src/components/common/PromptDialog.vue'
import i18n from 'src/i18n'

/**
 * ---------------------------------------------------------------------------
 * Global confirmation dialogs
 * ---------------------------------------------------------------------------
 * `confirmAction()` renders `ConfirmDialog` through Quasar's Dialog plugin and
 * resolves `true` only after the supplied `onConfirm` work has **succeeded**.
 * While it runs the OK button spins and is disabled (no duplicate requests);
 * if the backend rejects, the dialog stays open and an error toast is shown.
 *
 *   const ok = await confirmAction({
 *     title: 'Delete employee?',
 *     message: 'This action cannot be undone.',
 *     okLabel: 'Delete',
 *     onConfirm: () => employeeService.remove(row.id),
 *   })
 *   if (ok) await load()
 */

const t = (key, params) => {
  try {
    return i18n.global.te(key) ? i18n.global.t(key, params) : key
  } catch {
    return key
  }
}

export function confirmAction({
  title,
  message,
  detail,
  okLabel,
  busyLabel,
  cancelLabel,
  icon = 'help_outline',
  color = 'negative',
  onConfirm,
  onConfirmed,
  errorMessage,
  cardStyle,
} = {}) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    try {
      Dialog.create({
        component: ConfirmDialog,
        componentProps: {
          title: title || t('common.confirm'),
          message: message || '',
          detail: detail || '',
          okLabel: okLabel || t('common.confirm'),
          busyLabel: busyLabel || t('common.working'),
          cancelLabel: cancelLabel || t('common.cancel'),
          icon,
          color,
          onConfirm: typeof onConfirm === 'function' ? onConfirm : null,
          onConfirmed: typeof onConfirmed === 'function' ? onConfirmed : null,
          errorMessage: errorMessage || '',
          cardStyle,
        },
      })
        .onOk((data) => finish(data === undefined ? true : data))
        .onCancel(() => finish(false))
    } catch (err) {
      // The Dialog plugin is not installed (or SSR) — fail safe, never throw.
      console.error('[confirmAction] unable to open the confirmation dialog:', err)
      finish(false)
    }
  })
}

/**
 * Standard destructive confirmation.
 * @param {'delete'|'archive'} verb
 */
export function confirmDelete({
  entity,
  name,
  verb = 'delete',
  title,
  message,
  okLabel,
  onConfirm,
  onConfirmed,
}) {
  const isArchive = verb === 'archive'
  return confirmAction({
    title: title || (isArchive ? t('common.confirmArchiveTitle') : t('common.confirmDeleteTitleEntity', { entity })),
    message:
      message ||
      (isArchive
        ? t('common.confirmArchiveMessage', { entity, name: name ?? '' })
        : t('common.confirmDeleteMessageEntity', { entity, name: name ?? '' })),
    okLabel: okLabel || (isArchive ? t('common.archive') : t('common.delete')),
    busyLabel: isArchive ? t('common.archiving') : t('common.deleting'),
    icon: isArchive ? 'archive' : 'delete_forever',
    color: 'negative',
    onConfirm,
    onConfirmed,
  })
}

/**
 * Ask for a few values and only close once the work has succeeded.
 *
 * Drop-in replacement for Quasar's `Dialog.create({ prompt | options })`, which
 * closes immediately and therefore cannot show a loading state or keep the
 * dialog open when the backend rejects.
 *
 *   const res = await promptAction({
 *     title: 'Complete work order',
 *     fields: [
 *       { name: 'result', label: 'Result', type: 'textarea', required: true },
 *       { name: 'cost', label: 'Cost (AFN)', type: 'number', value: 0 },
 *     ],
 *     onConfirm: (values) => maintenanceService.transition(id, values),
 *   })
 *   if (res.ok) await load()
 *
 * @returns {Promise<{ok: boolean, values?: object, cancelled?: boolean}>}
 */
export function promptAction({
  title,
  message,
  okLabel,
  busyLabel,
  cancelLabel,
  icon = 'edit',
  color = 'primary',
  fields = [],
  onConfirm,
  onConfirmed,
  errorMessage,
  requiredMessage,
  cardStyle,
} = {}) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    try {
      Dialog.create({
        component: PromptDialog,
        componentProps: {
          title: title || t('common.confirm'),
          message: message || '',
          okLabel: okLabel || t('common.save'),
          busyLabel: busyLabel || t('common.working'),
          cancelLabel: cancelLabel || t('common.cancel'),
          icon,
          color,
          fields,
          onConfirm: typeof onConfirm === 'function' ? onConfirm : null,
          onConfirmed: typeof onConfirmed === 'function' ? onConfirmed : null,
          errorMessage: errorMessage || '',
          requiredMessage: requiredMessage || t('common.required'),
          cardStyle,
        },
      })
        .onOk((payload) => {
          const { __result, ...values } = payload || {}
          finish({ ok: true, values, result: __result })
        })
        .onCancel(() => finish({ ok: false, cancelled: true }))
    } catch (err) {
      // Dialog plugin unavailable (or SSR) — fail safe, never throw.
      console.error('[promptAction] unable to open the prompt dialog:', err)
      finish({ ok: false, cancelled: true })
    }
  })
}

export default confirmAction
