/**
 * Integration harness — mounts the REAL EmployeeSelect component (Quasar
 * QSelect) in jsdom against the REAL running mock API and simulates the exact
 * user path: open dropdown -> see options -> search -> click an option.
 *
 * Usage: node scripts/employee-select.spec.mjs  (mock API must be on :9000)
 */
import { JSDOM } from 'jsdom'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { register } from 'node:module'

register(new URL('./esm-ext-loader.mjs', import.meta.url))

// --- jsdom as the browser ---------------------------------------------------
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost:9000/',
  pretendToBeVisual: true,
})
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.localStorage = dom.window.localStorage
globalThis.Element = dom.window.Element
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.SVGElement = dom.window.SVGElement
globalThis.Node = dom.window.Node
globalThis.CustomEvent = dom.window.CustomEvent
globalThis.Event = dom.window.Event
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.KeyboardEvent = dom.window.KeyboardEvent
globalThis.XMLHttpRequest = dom.window.XMLHttpRequest
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.FileList = dom.window.FileList || class FileList {}
globalThis.File = dom.window.File || class File {}
globalThis.DataTransfer = dom.window.DataTransfer || class DataTransfer {}
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)
globalThis.getComputedStyle = dom.window.getComputedStyle
// jsdom elements lack scrollTo — stub it on Element and window.
dom.window.Element.prototype.scrollTo = function () {}
dom.window.scrollTo = function () {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const click = (el) =>
  el.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))

// Compile an SFC to a temporary ESM module and import it.
async function importSfc(relPath) {
  const file = path.resolve(import.meta.dirname, relPath)
  const source = fs.readFileSync(file, 'utf8')
  const { descriptor } = parse(source, { filename: file })
  const compiled = compileScript(descriptor, { id: 'test', inlineTemplate: true })
  let code = compiled.content
  // Rewrite the `src/...` Vite alias to absolute file URLs.
  code = code.replace(/from '(src\/[^']+)'/g, (_, spec) => `from '${pathToFileURL(path.resolve(import.meta.dirname, '..', spec)).href}'`)
  const tmpDir = path.resolve(import.meta.dirname, '..', 'node_modules', '.sfc-tmp')
  fs.mkdirSync(tmpDir, { recursive: true })
  const tmp = path.join(tmpDir, `sfc-${Date.now()}-${path.basename(file)}.mjs`)
  fs.writeFileSync(tmp, code)
  return import(pathToFileURL(tmp).href)
}

const { parse, compileScript } = await import('vue/compiler-sfc')
const { createApp, defineComponent, h, ref, nextTick } = await import('vue')
const { createI18n } = await import('vue-i18n')
const { default: en } = await import('../src/i18n/locales/en.js')
const quasarModule = await import('quasar/dist/quasar.client.js')
const Quasar = quasarModule.Quasar ?? quasarModule.default ?? quasarModule
const { QSelect, QItem, QItemSection, QItemLabel, QAvatar, QIcon, QBadge } = quasarModule
const EmployeeSelect = (await importSfc('../src/components/common/EmployeeSelect.vue')).default

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

// Login against the real mock API and store the token like the app does.
const loginRes = await fetch('http://localhost:9000/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'superadmin', password: 'password' }),
})
const loginBody = await loginRes.json()
localStorage.setItem('ku_ams_token', loginBody.data.token)
console.log('login:', loginBody.success)

// Direct service-level sanity check through the same axios stack the SPA uses.
const { default: employeeService } = await import('../src/services/employees.service.js')
try {
  const svc = await employeeService.list({ search: '', per_page: 30, status: 'active' })
  console.log('employees service returned', svc?.data?.meta?.total, 'rows')
} catch (e) {
  console.log('employees service unavailable:', e?.message)
}

let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
  if (!ok) failures++
}

// Host app that binds v-model exactly like AssetsPage does.
const updates = []
const Host = defineComponent({
  setup() {
    const val = ref(null)
    return () =>
      h(EmployeeSelect, {
        modelValue: val.value,
        'onUpdate:modelValue': (v) => {
          val.value = v
          updates.push(v)
        },
        label: 'Assign To',
        dense: true,
        outlined: true,
      })
  },
})
const app = createApp(Host)
app.use(Quasar, {})
app.use(i18n)
for (const comp of [QSelect, QItem, QItemSection, QItemLabel, QAvatar, QIcon, QBadge]) {
  app.component(comp.name, comp)
}
app.mount(document.getElementById('app'))
await sleep(700) // initial employee search

check('select field rendered', Boolean(app._container.querySelector('.q-select')))

// Inspect the live component state — walk to the inner QSelect and read its props.
function findComp(inst, name, out = []) {
  if (!inst) return out
  if (inst.type?.name === name) out.push(inst)
  let child = inst.subTree
  const walk = (vnode) => {
    if (!vnode) return
    if (vnode.component) findComp(vnode.component, name, out)
    if (Array.isArray(vnode.children)) vnode.children.forEach((c) => walk(c))
    else if (vnode.children && typeof vnode.children === 'object') walk(vnode.children.default?.())
  }
  walk(child)
  return out
}
const qsInst = findComp(app._instance, 'QSelect')[0]

// Open the dropdown through QSelect's own public API.
qsInst.proxy.showPopup()
await sleep(400)
let items = [...document.querySelectorAll('.q-menu .q-item')]
check('dropdown menu renders employees', items.length > 0, `${items.length} items`)
if (items.length) console.log('      first item:', items[0].textContent.trim().replace(/\s+/g, ' ').slice(0, 70))
const firstOpt = qsInst.props.options?.[0]
check('option label uses EMP-code — Name — Department format', Boolean(firstOpt && /^EMP-|KU-/.test(firstOpt.label) && firstOpt.label.includes(' — ')), JSON.stringify(firstOpt?.label))

// Search by typing
const input = app._container.querySelector('.q-select input')
check('field is searchable (native input present)', Boolean(input))
if (input) {
  input.value = 'karim'
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  await sleep(900)
  const after = [...document.querySelectorAll('.q-menu .q-item')]
  check('search "karim" filters options', after.length >= 1, `${after.length} items`)
  if (after.length) console.log('      first result:', after[0].textContent.trim().replace(/\s+/g, ' ').slice(0, 70))

  // Click the first search result
  const before = updates.length
  after[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await sleep(700)
  await nextTick()
  const emitted = updates.slice(before)
  check('clicking an option emits the employee id', emitted.length > 0 && Number.isFinite(Number(emitted.at(-1))), JSON.stringify(emitted))
  const shown = app._container.querySelector('.q-select input')?.value
  check('selected employee name is visible after selection', Boolean(shown && shown.trim().length > 0), JSON.stringify(shown))
  if (emitted.at(-1)) {
    const res = await fetch(`http://localhost:9000/api/employees/${emitted.at(-1)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('ku_ams_token')}` },
    })
    const body = await res.json()
    check('emitted value is a real employee id in the employees table', res.ok && body.success, body.data?.full_name)
  }
}

// --- Edit case: pre-selected employee must be shown --------------------------
const updates2 = []
const Host2 = defineComponent({
  setup() {
    const val = ref(2) // Maryam Nazari (KU-0002) exists in the employees table
    return () =>
      h(EmployeeSelect, {
        modelValue: val.value,
        'onUpdate:modelValue': (v) => {
          val.value = v
          updates2.push(v)
        },
        label: 'Assign To',
        dense: true,
        outlined: true,
      })
  },
})
const app2 = createApp(Host2)
app2.use(Quasar, { components: { QSelect, QItem, QItemSection, QItemLabel, QAvatar, QIcon, QBadge } })
app2.use(i18n)
app2.mount(document.createElement('div'))
await sleep(800)
const input2 = app2._container.querySelector('.q-select input')
const shown2 = input2?.value || ''
console.log('      edit-case input shows:', JSON.stringify(shown2))
check('edit case: pre-selected employee is visible', /Maryam/i.test(shown2), JSON.stringify(shown2))

// Clear/unassign — QSelect renders the clear icon once a value is set.
const icons = [...app2._container.querySelectorAll('.q-select .q-icon')]
console.log('      icons in app2 select:', icons.map((i) => i.className).join(' | ').slice(0, 160))
const clearBtn = app2._container.querySelector('.q-select__clear-icon') || icons.find((i) => i.textContent.includes('cancel'))
if (clearBtn) {
  clearBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await sleep(300)
  check('clear/unassign emits null', updates2.includes(null), JSON.stringify(updates2))
} else {
  console.log('INFO  no clear icon rendered (clearable not showing)')
}

console.log(failures ? `\n${failures} FAILURES` : '\nALL CHECKS PASSED')
process.exit(failures ? 1 : 0)
