/**
 * ESM resolve/load hooks for the jsdom test harness:
 *  1. maps the Vite `src/…` alias to the real frontend/src directory,
 *  2. falls back to `.js` / `/index.js` for extension-less relative imports,
 *  3. compiles `.vue` single-file components on the fly (script setup +
 *     inline template) so components can import each other like in the app.
 */
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parse, compileScript } from 'vue/compiler-sfc'

const SRC_ROOT = pathToFileURL(new URL('../src/', import.meta.url).pathname).href

function inlineEnv(source) {
  return String(source).replaceAll(
    'import.meta.env',
    "({ VITE_API_BASE: 'http://localhost:9000/api', MODE: 'development', DEV: true })",
  )
}

export async function load(url, context, next) {
  if (url.startsWith(SRC_ROOT) && url.endsWith('.vue')) {
    const filePath = new URL(url).pathname
    const source = fs.readFileSync(filePath, 'utf8')
    const { descriptor } = parse(source, { filename: filePath })
    const compiled = compileScript(descriptor, { id: filePath, inlineTemplate: true })
    return { format: 'module', shortCircuit: true, source: inlineEnv(compiled.content) }
  }
  if (url.startsWith(SRC_ROOT)) {
    const { source } = await next(url, context)
    // Emulate Vite's `import.meta.env` define for the plain-node harness by
    // inlining the env object literal.
    return { format: 'module', shortCircuit: true, source: inlineEnv(source) }
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
