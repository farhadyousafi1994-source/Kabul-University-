/**
 * Tiny timing helpers shared by the theme centre and the search inputs.
 */

/** Classic trailing-edge debounce. Returns a function with `.cancel()`. */
export function debounce(fn, wait = 250) {
  let timer = null
  const wrapped = (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, wait)
  }
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  wrapped.flush = (...args) => {
    wrapped.cancel()
    fn(...args)
  }
  return wrapped
}

/** Leading-edge throttle — at most one call per `wait` ms. */
export function throttle(fn, wait = 100) {
  let last = 0
  let timer = null
  return (...args) => {
    const now = Date.now()
    const remaining = wait - (now - last)
    if (remaining <= 0) {
      last = now
      fn(...args)
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now()
        timer = null
        fn(...args)
      }, remaining)
    }
  }
}
