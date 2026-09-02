import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Dark } from 'quasar'
import quasarIconSet from 'quasar/icon-set/material-icons'
import VueApexCharts from 'vue3-apexcharts'

// Core styles
//
// Quasar ships RTL support as a separate build whose rules are scoped by
// direction (`[dir=ltr] …` / `[dir=rtl] …`). Compiling the Sass source
// (`quasar/src/css/index.sass`) only ever produces the *LTR* rules, which is
// why switching to Dari/Pashto/Arabic used to translate the text but leave
// every spacing, alignment and positioning utility pointing the wrong way.
//
// So we load the pre-built RTL stylesheet instead — it contains both
// directions, verified to expose the same class list as the Sass build — and
// re-apply the brand palette right after it (see src/css/quasar.brand.sass).
import 'quasar/dist/quasar.rtl.css'
import './css/quasar.brand.sass'
import '@quasar/extras/material-icons/material-icons.css'
// MDI is needed for the shared table action bar (import / tune / excel / pdf icons)
import '@quasar/extras/mdi-v7/mdi-v7.css'
import '@quasar/extras/roboto-font/roboto-font.css'
import './css/app.sass'

// App
import App from './App.vue'
import router from './router'
import i18n, { initialLocale, applyLocale, SUPPORTED_LANGUAGES } from './i18n'

// Boot modules (auth bootstrap, axios registration)
import { registerAxios } from './boot/axios'
import { bootstrapAuth } from './boot/auth'
import { useThemeStore } from './stores/theme'

const app = createApp(App)
const pinia = createPinia()

const initialLangConfig = SUPPORTED_LANGUAGES.find((l) => l.code === initialLocale) || SUPPORTED_LANGUAGES[0]

app.use(pinia)

// Restore the user's appearance (scheme, dark mode, font size, …) before the
// first paint so the whole app — including the login screen — is themed.
useThemeStore().applyInitial()
app.use(router)
app.use(i18n)
app.use(VueApexCharts)
app.use(Quasar, {
  lang: initialLangConfig.quasarLang,
  iconSet: quasarIconSet,
  config: {
    dark: Dark.isActive, // follow system preference; togglable from the layout
    brand: {
      primary: '#C8862D',
      secondary: '#175A8C',
      accent: '#0B1626',
    },
    notify: { position: 'top-right', timeout: 3500 },
  },
})

// Ensure initial HTML dir/lang attributes are set
applyLocale(initialLocale)

registerAxios(app)

// Restore the session (token + current user) before the first render.
bootstrapAuth().finally(() => {
  app.mount('#q-app')
})
