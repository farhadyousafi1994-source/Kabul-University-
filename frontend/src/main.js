import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Dark } from 'quasar'
import quasarLang from 'quasar/lang/en-US'
import quasarIconSet from 'quasar/icon-set/material-icons'
import VueApexCharts from 'vue3-apexcharts'

// Core styles
import 'quasar/src/css/index.sass'
import '@quasar/extras/material-icons/material-icons.css'
import '@quasar/extras/roboto-font/roboto-font.css'
import './css/app.sass'

// App
import App from './App.vue'
import router from './router'

// Boot modules (auth bootstrap, axios registration)
import { registerAxios } from './boot/axios'
import { bootstrapAuth } from './boot/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(VueApexCharts)
app.use(Quasar, {
  lang: quasarLang,
  iconSet: quasarIconSet,
  config: {
    dark: Dark.isActive, // follow system preference; togglable from the layout
    brand: {
      primary: '#1b5e20',
      secondary: '#0d47a1',
      accent: '#b71c1c',
    },
    notify: { position: 'top-right', timeout: 3500 },
  },
})

registerAxios(app)

// Restore the session (token + current user) before the first render.
bootstrapAuth().finally(() => {
  app.mount('#q-app')
})
