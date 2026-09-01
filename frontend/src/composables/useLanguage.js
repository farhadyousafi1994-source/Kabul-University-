import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { SUPPORTED_LANGUAGES, DEFAULT_LOCALE, applyLocale } from 'src/i18n'
import api from 'src/boot/axios'

export function useLanguage() {
  const { locale, t, te } = useI18n()
  const $q = useQuasar()

  const currentLocale = computed(() => locale.value)
  const currentLanguage = computed(
    () => SUPPORTED_LANGUAGES.find((l) => l.code === locale.value) || SUPPORTED_LANGUAGES[0]
  )
  const isRtl = computed(() => currentLanguage.value.dir === 'rtl')

  function setLanguage(langCode) {
    const config = applyLocale(langCode, $q)
    // Update API Accept-Language header
    if (api && api.defaults && api.defaults.headers) {
      api.defaults.headers.common['Accept-Language'] = langCode
    }
    return config
  }

  return {
    locale,
    currentLocale,
    currentLanguage,
    isRtl,
    languages: SUPPORTED_LANGUAGES,
    defaultLocale: DEFAULT_LOCALE,
    setLanguage,
    t,
    te,
  }
}
