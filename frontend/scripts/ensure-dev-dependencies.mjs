import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// These packages are imported by src/utils/export.js. When a developer pulls a
// newer package.json but keeps an old node_modules folder, Vite fails during
// dependency scanning with "Failed to resolve import \"jspdf\"/\"xlsx\"".
// Install the locked dependencies before the dev server starts so `npm run dev`
// recovers automatically on Windows/WAMP and fresh checkouts alike.
const requiredPackages = ['jspdf', 'jspdf-autotable', 'xlsx']
const missing = requiredPackages.filter((pkg) => {
  try {
    require.resolve(pkg)
    return false
  } catch {
    return true
  }
})

if (!missing.length) process.exit(0)

console.log(`Missing frontend packages: ${missing.join(', ')}`)
console.log('Installing dependencies from package-lock.json before starting Vite...')

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const result = spawnSync(npmCommand, ['install'], {
  cwd: frontendDir,
  stdio: 'inherit',
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
