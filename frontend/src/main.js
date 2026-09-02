import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Dark, Notify, Dialog, Loading, ClosePopup } from 'quasar'
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
import './css/theme.css'
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
// ---------------------------------------------------------------------------
// Quasar installation
//
// `plugins` is REQUIRED. Without it `$q.notify` / `$q.dialog` are `undefined`
// and every success toast and every confirmation dialog in the application
// throws `TypeError: $q.notify is not a function` — which silently aborts the
// CRUD flow *after* the API call succeeded (the dialog closed, but the list was
// never refreshed and no notification was shown). Registering the plugins here
// is what makes the global "notify → close → refresh" behaviour actually work.
//
// They are also usable as singletons (`Notify.create(...)`) from plain modules —
// see src/utils/notify.js — which keeps notifications working outside of
// components (stores, services, router guards).
// ---------------------------------------------------------------------------
app.use(Quasar, {
  lang: initialLangConfig.quasarLang,
  iconSet: quasarIconSet,
  plugins: { Notify, Dialog, Loading, ClosePopup },
  config: {
    dark: Dark.isActive, // follow system preference; togglable from the layout
    brand: {
      primary: '#C8862D',
      secondary: '#175A8C',
      accent: '#0B1626',
    },
    notify: {
      position: 'top',
      timeout: 3500,
      group: false,
      classes: 'ku-notify',
    },
    loading: {},
  },
})

// Ensure initial HTML dir/lang attributes are set
applyLocale(initialLocale)

registerAxios(app)

// Restore the session (token + current user) before the first render.
bootstrapAuth().finally(() => {
  app.mount('#q-app')
})
