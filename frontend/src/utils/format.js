import i18n from 'src/i18n'

/**
 * Shared display formatters with internationalization support.
 */
export function currency(value, currencyCode = 'AFN') {
  const n = Number(value || 0)
  const currentLocale = i18n?.global?.locale?.value || 'en'
  const t = i18n?.global?.t

  const formattedNum = new Intl.NumberFormat(
    currentLocale === 'fa' ? 'fa-AF' : currentLocale === 'ps' ? 'ps-AF' : currentLocale === 'ar' ? 'ar-SA' : 'en-US',
    { maximumFractionDigits: 0 }
  ).format(n)

  const currencyLabel = t ? t('common.currency') : currencyCode
  return `${formattedNum} ${currencyLabel}`
}

export function date(value, withTime = false) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const currentLocale = i18n?.global?.locale?.value || 'en'
  const dateLocale = currentLocale === 'fa' ? 'fa-AF' : currentLocale === 'ps' ? 'ps-AF' : currentLocale === 'ar' ? 'ar-SA' : 'en-GB'
  return d.toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' }) +
    (withTime ? ` ${d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}` : '')
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
