import { Notify } from 'quasar'
import i18n from 'src/i18n'
import { describeError, normaliseError, summariseFieldErrors } from './apiError'

/**
 * ---------------------------------------------------------------------------
 * KU-AMS global notification layer
 * ---------------------------------------------------------------------------
 * Every user-facing toast in the application goes through this module, so the
 * wording, icons, position and timing are identical on every page.
 *
 * It talks to Quasar's **plugin singleton** (`Notify.create`) rather than
 * `$q.notify`, which means it also works from Pinia stores, services, router
 * guards and plain utilities — anywhere a component instance is unavailable.
 *
 * Requires `plugins: { Notify }` in `app.use(Quasar, …)` (src/main.js).
 */

const t = (key, params) => {
  try {
    return i18n.global.te(key) ? i18n.global.t(key, params) : key
  } catch {
    return key
  }
}

const PRESETS = {
  positive: { type: 'positive', icon: 'check_circle', timeout: 3200, group: false },
  negative: { type: 'negative', icon: 'error', timeout: 6000, group: true },
  warning: { type: 'warning', icon: 'warning_amber', timeout: 5000, group: true },
  info: { type: 'info', icon: 'info', timeout: 3200, group: true },
}

/** Mirror the toast to the correct side in RTL languages. */
function defaultPosition() {
  if (typeof document === 'undefined') return 'top-right'
  return document.documentElement.getAttribute('dir') === 'rtl' ? 'top-left' : 'top-right'
}

function show(kind, message, options = {}) {
  if (message === null || message === undefined || message === '') return null
  const preset = PRESETS[kind] || PRESETS.info
  try {
    return Notify.create({
      position: defaultPosition(),
      textColor: 'white',
      ...preset,
      ...options,
      message: String(message),
      classes: ['ku-notify', options.classes].filter(Boolean).join(' '),
    })
  } catch (err) {
    // A notification must never be able to break a completed operation.
    console.warn('[notify] notification plugin unavailable:', message, err)
    return null
  }
}

export const notify = {
  /** ✓ "{entity} created successfully." */
  success: (message, options) => show('positive', message, options),
  /** ✕ operation failed */
  error: (message, options) => show('negative', message, options),
  warning: (message, options) => show('warning', message, options),
  info: (message, options) => show('info', message, options),

  /**
   * Render the correct toast for a rejected API call and hand back the
   * normalised error so callers can map validation messages onto fields:
   *  - validation (422) → "Unable to save … " + the field messages as caption
   *  - server / network → a generic, professional message
   */
  apiError(err, { fallback, caption, silent = false } = {}) {
    const e = normaliseError(err)
    if (silent) return e
    const message = e.isValidation
      ? fallback || t('common.saveFailed')
      : describeError(e, fallback || t('common.saveFailed'))
    const detail = caption !== undefined ? caption : e.isValidation ? summariseFieldErrors(e.allFieldErrors) : ''
    show('negative', message, detail ? { caption: detail } : {})
    return e
  },

  // -- CRUD message builders — wording is defined exactly once --------------
  created: (entity) => t('common.createdSuccessEntity', { entity }),
  updated: (entity) => t('common.updatedSuccessEntity', { entity }),
  deleted: (entity) => t('common.deletedSuccessEntity', { entity }),
  archived: (entity) => t('common.archivedSuccessEntity', { entity }),
  saved: (entity) => t('common.savedSuccessEntity', { entity }),
  assigned: (entity) => t('common.assignedSuccessEntity', { entity }),
  unassigned: (entity) => t('common.unassignedSuccessEntity', { entity }),
}

/** Translate through the global i18n instance (usable outside components). */
export function tt(key, params) {
  return t(key, params)
}

export default notify
