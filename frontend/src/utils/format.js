import i18n from 'src/i18n'
import { useOptionsStore } from 'src/stores/options'
import { useThemeStore } from 'src/stores/theme'

/**
 * Shared display formatters with internationalization support.
 *
 * Currency and calendar respect the user's personal options
 * (see stores/options.js and stores/theme.js) when they are available;
 * otherwise they fall back to sensible defaults.
 */

// ---------------------------------------------------------------------------
// Jalali (Solar Hijri) date conversion — minimal, dependency-free.
//
// Method: a fixed epoch (1 Farvardin 1379 = 2000-03-21 Gregorian) plus the
// standard 33-year Jalaali leap cycle [1,5,9,13,17,22,26,30]. Accurate for
// the range this UI deals with (±a few centuries).
// ---------------------------------------------------------------------------

const JALALI_MONTH_DAYS = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]
const JALALI_LEAP_OFFSETS = [1, 5, 9, 13, 17, 22, 26, 30]

const gregorianToJdn = (gy, gm, gd) => {
  const a = Math.floor((14 - gm) / 12)
  const y = gy + 4800 - a
  const m = gm + 12 * a - 3
  return gd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) -
    32045
}

const jalaliYearLength = (jy) =>
  JALALI_LEAP_OFFSETS.includes((((jy - 474) % 33) + 33) % 33) ? 366 : 365

// Rata die of 2000-03-21, which is 1 Farvardin 1379 in the Jalali calendar.
const EPOCH = { jdn: gregorianToJdn(2000, 3, 21), jy: 1379 }

/**
 * Convert a Date (or ISO string) to a Jalali date { jy, jm, jd }.
 */
export function toJalali(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const jdn = gregorianToJdn(d.getFullYear(), d.getMonth() + 1, d.getDate())

  // Walk from the epoch to find the Jalali year containing `jdn`.
  let jy = EPOCH.jy
  let yearStart = EPOCH.jdn
  if (jdn >= yearStart) {
    while (yearStart + jalaliYearLength(jy) <= jdn) {
      yearStart += jalaliYearLength(jy)
      jy += 1
    }
  } else {
    while (yearStart > jdn) {
      jy -= 1
      yearStart -= jalaliYearLength(jy)
    }
  }

  let jm = 1
  let day = jdn - yearStart + 1
  while (day > JALALI_MONTH_DAYS[jm - 1]) {
    day -= JALALI_MONTH_DAYS[jm - 1]
    jm += 1
  }
  return { jy, jm, jd: day }
}

export const JALALI_MONTHS_EN = [
  'Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar',
  'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand',
]

export const JALALI_MONTHS_FA = [
  'فرواردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

function localeFor() {
  const currentLocale = i18n?.global?.locale?.value || 'en'
  if (currentLocale === 'fa') return 'fa-AF'
  if (currentLocale === 'ps') return 'ps-AF'
  if (currentLocale === 'ar') return 'ar-SA'
  return 'en-US'
}

/**
 * Personal options. These helpers are only ever called during component
 * rendering (after pinia is installed), so the stores are safe here.
 */
function optionsNow() {
  try {
    return useOptionsStore().$state
  } catch {
    return { currency: 'AFN', usdRate: 70, rowsPerPage: 20 }
  }
}

function calendarNow() {
  try {
    return useThemeStore().settings?.calendar || 'gregorian'
  } catch {
    return 'gregorian'
  }
}

export function currency(value, currencyCode) {
  const opts = optionsNow()
  const code = currencyCode || opts.currency || 'AFN'
  let n = Number(value || 0)
  if (code === 'USD') n = n / (Number(opts.usdRate) || 70)

  const formattedNum = new Intl.NumberFormat(localeFor(), { maximumFractionDigits: code === 'USD' ? 2 : 0 }).format(n)
  const t = i18n?.global?.t
  const currencyLabel = t ? (code === 'USD' ? t('common.currency_USD') : t('common.currency')) : code
  return `${formattedNum} ${currencyLabel}`
}

export function date(value, withTime = false) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value

  if (calendarNow() === 'solar') {
    const j = toJalali(d)
    if (j) {
      const months = localeFor() === 'en' ? JALALI_MONTHS_EN : JALALI_MONTHS_FA
      const out = `${String(j.jd).padStart(2, '0')} ${months[j.jm - 1]} ${j.jy}`
      if (withTime) return out + ` ${d.toLocaleTimeString(localeFor(), { hour: '2-digit', minute: '2-digit' })}`
      return out
    }
  }

  const dateLocale = localeFor()
  const timeLocale = localeFor() === 'en' ? 'en-GB' : dateLocale
  return d.toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' }) +
    (withTime ? ` ${d.toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}` : '')
}

export function timeAgo(value) {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  const mins = Math.floor(diff / 60000)
  const t = i18n?.global?.t

  if (!t) {
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months}mo ago`
    return `${Math.floor(months / 12)}y ago`
  }

  if (mins < 1) return t('common.justNow')
  if (mins < 60) return t('common.minsAgo', { m: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('common.hoursAgo', { h: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('common.daysAgo', { d: days })
  const months = Math.floor(days / 30)
  if (months < 12) return t('common.monthsAgo', { m: months })
  return t('common.yearsAgo', { y: Math.floor(months / 12) })
}

export const titleCase = (s = '') => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/**
 * Human-readable file size (used by the backup/DR screen).
 */
export function fileSize(bytes) {
  const n = Number(bytes || 0)
  if (!n) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  const value = n / 1024 ** i
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
