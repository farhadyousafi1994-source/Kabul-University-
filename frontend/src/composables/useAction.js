import { computed, reactive, ref, unref } from 'vue'
import { notify } from 'src/utils/notify'
import { normaliseError } from 'src/utils/apiError'

/**
 * ---------------------------------------------------------------------------
 * useAction — the single async-action lifecycle used by the whole application
 * ---------------------------------------------------------------------------
 *
 *   USER ACTION → LOADING → API → SUCCESS (notify → close → refresh)
 *                              └→ ERROR   (notify → keep open → retry)
 *
 * It guarantees, for every Create / Edit / Update / Delete / Assign / Unassign
 * / Submit operation:
 *
 *  1. `pending` is true for exactly the duration of the request, so buttons can
 *     be disabled and show a spinner.
 *  2. Duplicate submissions are impossible — a second call while `pending`
 *     resolves to `undefined` without touching the network.
 *  3. On a confirmed successful response the success notification fires, then
 *     `onSuccess` runs (closing the dialog and refreshing the table).
 *  4. On failure nothing is closed or reset: the error notification is shown,
 *     server validation messages are mapped onto `fieldErrors` so they render
 *     next to the relevant inputs, and the user's data is preserved.
 */
export function useAction(options = {}) {
  const pending = ref(false)
  const fieldErrors = reactive({})
  const lastError = ref(null)

  const resolveText = (value, ctx) => (typeof value === 'function' ? value(ctx) : unref(value))

  function clearFieldErrors() {
    for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]
  }

  /**
   * @param {object} err  normalised error
   * @param {string[]} [allow] optional whitelist of fields that have an input
   */
  function applyFieldErrors(err, allow) {
    clearFieldErrors()
    const source = err?.allFieldErrors || {}
    for (const [key, messages] of Object.entries(source)) {
      if (allow && !allow.includes(key)) continue
      if (messages?.length) fieldErrors[key] = messages[0]
    }
  }

  /**
   * Run an async task with the standard lifecycle.
   *
   * @param {Function} task            () => Promise<any>
   * @param {object}   opts
   *   successMessage  string|fn      toast shown after a confirmed success
   *   errorMessage    string|fn      override for the failure toast
   *   notifyOnSuccess boolean=true
   *   notifyOnError   boolean=true
   *   onSuccess       fn(result)     runs AFTER the success toast (close/refresh)
   *   onError         fn(err)        extra handling; the dialog stays open
   *   errorFields     string[]       whitelist of fields allowed to show errors
   *   silent          boolean        suppress both toasts
   * @returns {Promise<{ok:boolean, result?:any, error?:object}>}
   */
  async function run(task, opts = {}) {
    if (pending.value) return { ok: false, skipped: true }

    const {
      successMessage,
      errorMessage,
      notifyOnSuccess = true,
      notifyOnError = true,
      onSuccess,
      onError,
      errorFields,
      silent = false,
      successOptions,
    } = { ...options, ...opts }

    pending.value = true
    lastError.value = null
    clearFieldErrors()

    try {
      const result = await task()
      if (!silent && notifyOnSuccess) {
        const message = resolveText(successMessage, { result })
        if (message) notify.success(message, successOptions)
      }
      if (onSuccess) await onSuccess(result)
      return { ok: true, result }
    } catch (rawError) {
      const err = normaliseError(rawError)
      lastError.value = err
      applyFieldErrors(err, errorFields)
      if (!silent && notifyOnError) {
        notify.apiError(err, {
          fallback: resolveText(errorMessage, { error: err }) || undefined,
        })
      }
      if (onError) await onError(err)
      return { ok: false, error: err }
    } finally {
      pending.value = false
    }
  }

  return {
    pending,
    /** alias used by submit buttons: `:loading="saving"` / `:disable="saving"` */
    isSubmitting: computed(() => pending.value),
    fieldErrors,
    lastError,
    clearFieldErrors,
    applyFieldErrors,
    run,
  }
}

export default useAction
