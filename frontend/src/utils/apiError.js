/**
 * API error normalisation — one shape for every failure in the application.
 *
 * The axios response interceptor (src/boot/axios.js) already rejects with
 * `{ status, message, errors, data }`, but individual pages also throw plain
 * `Error`s (network failures, timeouts, programming errors). Everything is
 * funnelled through `normaliseError()` so the UI layer never has to guess.
 *
 * Normalised shape:
 *   {
 *     status:        number        // HTTP status, 0 when unknown
 *     message:       string        // human readable summary
 *     fieldErrors:   { [field]: string }   // first message per field
 *     allFieldErrors:{ [field]: string[] } // every message per field
 *     isValidation:  boolean       // 422 with a field map
 *     isNetwork:     boolean       // request never reached the server
 *     isServer:      boolean       // 5xx
 *     raw:           any           // the original rejection
 *   }
 */

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.'

function toArray(value) {
  if (value === null || value === undefined) return []
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [String(value)]
}

/** Laravel / mock-API field errors can be `{ field: [msg] }` or `{ field: msg }`. */
export function normaliseFieldErrors(errors) {
  const all = {}
  const first = {}
  if (!errors || typeof errors !== 'object') return { all, first }

  for (const [field, value] of Object.entries(errors)) {
    const list = toArray(value)
    if (!list.length) continue
    all[field] = list
    first[field] = list[0]
  }
  return { all, first }
}

export function normaliseError(err) {
  if (!err) {
    return {
      status: 0,
      message: FALLBACK_MESSAGE,
      fieldErrors: {},
      allFieldErrors: {},
      isValidation: false,
      isNetwork: false,
      isServer: false,
      raw: err,
    }
  }

  // Already normalised — pass straight through.
  if (err.__normalised) return err

  const status = Number(err.status || err.response?.status || 0)
  const { all, first } = normaliseFieldErrors(err.errors || err.response?.data?.errors)
  const hasFields = Object.keys(all).length > 0

  const message =
    err.message ||
    err.response?.data?.message ||
    err.data?.message ||
    FALLBACK_MESSAGE

  return {
    __normalised: true,
    status,
    message,
    fieldErrors: first,
    allFieldErrors: all,
    isValidation: status === 422 || (hasFields && !status),
    isNetwork: status === 0,
    isServer: status >= 500,
    raw: err,
  }
}

/** Join every field message into one readable line for a toast caption. */
export function summariseFieldErrors(fieldErrors, separator = ' · ') {
  const values = Object.values(fieldErrors || {})
  if (!values.length) return ''
  return values
    .map((v) => (Array.isArray(v) ? v[0] : v))
    .filter(Boolean)
    .join(separator)
}

/**
 * The message a user should see when an operation fails.
 * - validation errors  → the field messages (so the user knows what to fix)
 * - server errors      → a generic, non-technical message
 * - anything else      → whatever the API said
 */
export function describeError(err, fallback = FALLBACK_MESSAGE) {
  const e = normaliseError(err)
  const fields = summariseFieldErrors(e.allFieldErrors)
  if (fields) return fields
  if (e.isServer) return fallback
  return e.message || fallback
}

export default normaliseError
