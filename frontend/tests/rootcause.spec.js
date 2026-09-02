import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { Quasar, Notify, Dialog, useQuasar } from 'quasar'

const Probe = defineComponent({
  setup() {
    const $q = useQuasar()
    return () => h('div', JSON.stringify({
      notify: typeof $q.notify,
      dialog: typeof $q.dialog,
      loading: typeof $q.loading,
      screen: typeof $q.screen,
    }))
  },
})

describe('Quasar plugin registration (as in src/main.js)', () => {
  it('WITHOUT plugins -> $q.notify / $q.dialog are undefined', () => {
    const w = mount(Probe, { global: { plugins: [[Quasar, { config: {} }]] } })
    console.log('no-plugins:', w.text())
    expect(w.text()).toContain('"notify":"undefined"')
  })
  it('WITH plugins -> available', () => {
    const w = mount(Probe, { global: { plugins: [[Quasar, { plugins: { Notify, Dialog } }]] } })
    console.log('with-plugins:', w.text())
    expect(w.text()).toContain('"notify":"function"')
  })
})
