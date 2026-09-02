/**
 * ESM resolve hook for the jsdom test harness:
 *  1. maps the Vite `src/…` alias to the real frontend/src directory,
 *  2. falls back to `.js` / `/index.js` for extension-less relative imports.
 */
import { pathToFileURL } from 'node:url'

const SRC_ROOT = pathToFileURL(new URL('../src/', import.meta.url).pathname).href

export async function load(url, context, next) {
  if (url.startsWith(SRC_ROOT)) {
    const { source } = await next(url, context)
    // Emulate Vite's `import.meta.env` define for the plain-node harness by
    // inlining the env object literal.
    const rewritten = String(source).replaceAll(
      'import.meta.env',
      "({ VITE_API_BASE: 'http://localhost:9000/api', MODE: 'development', DEV: true })",
    )
    return { format: 'module', shortCircuit: true, source: rewritten }
  }
  return next(url, context)
}

export async function resolve(specifier, context, next) {
  if (specifier === 'src' || specifier.startsWith('src/')) {
    specifier = SRC_ROOT + specifier.slice(4)
  }
  try {
    return await next(specifier, context)
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' && (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('file:'))) {
      for (const suffix of ['.js', '/index.js']) {
        try {
          return await next(specifier + suffix, context)
        } catch {
          /* try next suffix */
        }
      }
    }
    throw err
  }
}
