/**
 * ---------------------------------------------------------------------------
 * Web-font loader — on demand, once, never blocking.
 * ---------------------------------------------------------------------------
 *
 * Latin families and the default Farsi/Dari family (Vazirmatn) are preloaded
 * from `index.html` so the very first paint is already correct. Every other
 * family offered in Appearance → Language & Typography is fetched only when a
 * user actually selects it, by injecting a single <link rel="stylesheet">.
 *
 * All stacks in `src/config/themes.js` end in a system fallback, so if the CDN
 * is unreachable (offline campus network) the interface still renders in a
 * readable Persian-capable font instead of breaking.
 */

const GOOGLE = (family, axis = 'wght@300;400;500;600;700') =>
  `https://fonts.googleapis.com/css2?family=${family}:${axis}&display=swap`

/** font id → stylesheet URL. Ids match FONT_FAMILIES / PERSIAN_FONTS / ARABIC_FONTS. */
export const FONT_SOURCES = {
  // Latin
  inter: GOOGLE('Inter', 'wght@400;500;600;700;800'),
  roboto: GOOGLE('Roboto', 'wght@300;400;500;700'),
  poppins: GOOGLE('Poppins', 'wght@300;400;500;600;700'),
  'open-sans': GOOGLE('Open+Sans', 'wght@400;500;600;700'),
  'noto-sans': GOOGLE('Noto+Sans', 'wght@400;500;600;700'),

  // Farsi / Dari — Vazirmatn is a Google-hosted variable font.
  vazirmatn: GOOGLE('Vazirmatn', 'wght@300;400;500;600;700;800'),
  sahel: 'https://cdn.jsdelivr.net/gh/rastikerdar/sahel-font@v3.4.0/dist/font-face.css',
  shabnam: 'https://cdn.jsdelivr.net/gh/rastikerdar/shabnam-font@v5.0.1/dist/font-face.css',
  samim: 'https://cdn.jsdelivr.net/gh/rastikerdar/samim-font@v4.0.5/dist/font-face.css',
  estedad: 'https://cdn.jsdelivr.net/gh/aminabedi68/Estedad@v9.1.0/dist/font-face.css',

  // Arabic / Naskh
  'noto-naskh': GOOGLE('Noto+Naskh+Arabic', 'wght@400;500;600;700'),
  'noto-sans-arabic': GOOGLE('Noto+Sans+Arabic', 'wght@300;400;500;600;700'),
  cairo: GOOGLE('Cairo', 'wght@300;400;500;600;700'),

  // IRANSans has no public CDN: it is used when installed on the machine,
  // otherwise the stack falls back to Vazirmatn.
  iransans: null,
  arial: null,
  system: null,
  'system-fa': null,
  'system-ar': null,
}

const loaded = new Set()

/** Inject the stylesheet for `id` exactly once. Safe to call on every change. */
export function ensureWebFont(id) {
  if (!id || loaded.has(id)) return
  const href = FONT_SOURCES[id]
  loaded.add(id)
  if (!href || typeof document === 'undefined') return
  if (document.querySelector(`link[data-app-font="${id}"]`)) return

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.dataset.appFont = id
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
}

/** Load several families at once (latin + persian + arabic selections). */
export function ensureWebFonts(ids = []) {
  for (const id of ids) ensureWebFont(id)
}

export default ensureWebFont
