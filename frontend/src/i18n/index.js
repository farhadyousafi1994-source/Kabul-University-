import { createI18n } from 'vue-i18n'
import { Quasar } from 'quasar'
import quasarLangEn from 'quasar/lang/en-US'
import quasarLangFa from 'quasar/lang/fa'
import quasarLangAr from 'quasar/lang/ar'
import quasarLangPs from './quasar-ps.js'

import en from './locales/en.js'
import fa from './locales/fa.js'
import ps from './locales/ps.js'
import ar from './locales/ar.js'

export const STORAGE_KEY = 'ku_ams_locale'
export const DEFAULT_LOCALE = 'en'

export const SUPPORTED_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    dir: 'ltr',
    quasarLang: quasarLangEn,
  },
  {
    code: 'fa',
    name: 'Farsi (Dari)',
    nativeName: 'فارسی (دری)',
    flag: '🇦🇫',
    dir: 'rtl',
    quasarLang: quasarLangFa,
  },
  {
    code: 'ps',
    name: 'Pashto',
    nativeName: 'پښتو',
    flag: '🇦🇫',
    dir: 'rtl',
    quasarLang: quasarLangPs,
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    dir: 'rtl',
    quasarLang: quasarLangAr,
  },
]

const messages = {
  en,
  fa,
  ps,
  ar,
}

// Get initial locale from localStorage or default to English
function getSavedLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved
    }
  } catch {
    // localStorage may be unavailable
  }
  return DEFAULT_LOCALE
}

export const initialLocale = getSavedLocale()

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: DEFAULT_LOCALE,
  messages,
})

/**
 * Apply direction and Quasar lang pack for a given locale code.
 */
export function applyLocale(langCode, quasarInstance = null) {
  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === langCode) || SUPPORTED_LANGUAGES[0]
  const isRtl = langConfig.dir === 'rtl'

  // Update vue-i18n locale
  if (i18n.global.locale) {
    i18n.global.locale.value = langCode
  }

  // Update HTML & Body direction and lang attributes
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('dir', langConfig.dir)
    document.documentElement.setAttribute('lang', langCode)
    document.body.setAttribute('dir', langConfig.dir)
    if (isRtl) {
      document.body.classList.add('q-body--rtl')
    } else {
      document.body.classList.remove('q-body--rtl')
    }
  }

  // Update Quasar language pack
  if (quasarInstance && quasarInstance.lang) {
    quasarInstance.lang.set(langConfig.quasarLang)
  } else if (Quasar.lang && Quasar.lang.set) {
    Quasar.lang.set(langConfig.quasarLang)
  }

  // Persist preference
  try {
    localStorage.setItem(STORAGE_KEY, langCode)
  } catch {
    // ignore
  }

  return langConfig
}

export default i18n
