<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('options.title')" :subtitle="t('options.subtitle')" icon="tune" />

    <div class="row q-col-gutter-md">
      <!-- General -->
      <div class="col-12 col-md-6">
        <div class="op-card">
          <div class="op-card__head">
            <q-icon name="language" size="20px" color="primary" />
            <span class="text-weight-bold">{{ t('options.general') }}</span>
          </div>
          <div class="op-card__body">
            <div class="op-row">
              <div>
                <div class="op-row__label">{{ t('options.language') }}</div>
                <div class="op-row__hint">{{ t('options.applyNow') }}</div>
              </div>
              <q-select
                :model-value="lang.currentLocale"
                :options="langLanguages"
                option-label="label"
                option-value="value"
                dense outlined emit-value map-options
                :options-dense="true"
                style="min-width: 200px"
                @update:model-value="onLanguage"
              >
                <template #option="scope">
                  <q-item :q-item-scope="scope">
                    <q-item-section avatar><q-icon name="language" /></q-item-section>
                    <q-item-section>{{ scope.opt.label }}</q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>

            <div class="op-row">
              <div>
                <div class="op-row__label">{{ t('options.currency') }}</div>
                <div class="op-row__hint">1 USD = {{ optionsStore.usdRate }} {{ t('common.currency') }}</div>
              </div>
              <q-btn-toggle
                v-model="currencyLocal"
                unelevated
                dense
                spread
                no-caps
                :options="[{ label: 'AFN', value: 'AFN' }, { label: 'USD', value: 'USD' }]"
                @update:model-value="optionsStore.patch({ currency: $event })"
              />
            </div>

            <div class="op-row">
              <div>
                <div class="op-row__label">{{ t('options.dateFormat') }}</div>
                <div class="op-row__hint">
                  {{ previewDate }}
                </div>
              </div>
              <q-btn-toggle
                v-model="calendarLocal"
                unelevated
                dense
                spread
                no-caps
                :options="[
                  { label: t('options.gregorian'), value: 'gregorian' },
                  { label: t('options.solar'), value: 'solar' },
                ]"
                @update:model-value="onCalendar"
              />
            </div>

            <div class="op-row">
              <div>
                <div class="op-row__label">{{ t('options.rowsPerPage') }}</div>
              </div>
              <q-select
                :model-value="optionsStore.rowsPerPage"
                :options="[10, 20, 30, 50, 100].map((n) => ({ label: String(n), value: n }))"
                dense outlined emit-value map-options
                :options-dense="true"
                style="min-width: 110px"
                @update:model-value="optionsStore.patch({ rowsPerPage: $event })"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Appearance quick controls -->
      <div class="col-12 col-md-6">
        <div class="op-card">
          <div class="op-card__head">
            <q-icon name="palette" size="20px" color="primary" />
            <span class="text-weight-bold">{{ t('options.appearance') }}</span>
            <q-space />
            <q-btn flat dense no-caps color="primary" icon-right="open_in_new" :to="{ name: 'theme' }">
              {{ t('nav.items.theme') }}
            </q-btn>
          </div>
          <div class="op-card__body">
            <div class="op-row">
              <div>
                <div class="op-row__label">{{ t('theme.displayMode') }}</div>
                <div class="op-row__hint">{{ t('options.themeHint') }}</div>
              </div>
              <q-btn-toggle
                v-model="modeLocal"
                unelevated
                dense
                spread
                :options="[
                  { label: '☀', icon: 'light_mode', value: 'light', title: t('theme.light') },
                  { label: '☾', icon: 'dark_mode', value: 'dark', title: t('theme.dark') },
                ]"
                @update:model-value="onMode"
              />
            </div>

            <div class="op-row">
              <div>
                <div class="op-row__label">{{ t('theme.primaryColor') }}</div>
              </div>
              <div class="op-dots">
                <button
                  v-for="c in themeStore.quickColors"
                  :key="c"
                  class="op-dot"
                  :class="{ 'op-dot--on': themeStore.colors.primary === c }"
                  :style="{ background: c }"
                  @click="onPrimary(c)"
                />
              </div>
            </div>

            <div class="op-row">
              <div>
                <div class="op-row__label">{{ t('theme.sidebar') }}</div>
              </div>
              <q-btn-toggle
                v-model="sidebarLocal"
                unelevated
                dense
                spread
                no-caps
                :options="[
                  { label: 'Mini', value: 'mini' },
                  { label: t('theme.normal'), value: 'normal' },
                ]"
                @update:model-value="onSidebar"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import { useLanguage } from 'src/composables/useLanguage'
import { useOptionsStore } from 'src/stores/options'
import { useThemeStore } from 'src/stores/theme'
import { date as formatDate } from 'src/utils/format'

const { t } = useI18n()
const $q = useQuasar()
const lang = useLanguage()
const optionsStore = useOptionsStore()
const themeStore = useThemeStore()

const currencyLocal = computed(() => optionsStore.currency)
const calendarLocal = computed(() => themeStore.settings.calendar)
const modeLocal = computed(() => themeStore.settings.mode)
const sidebarLocal = computed(() => themeStore.settings.sidebar)

const previewDate = computed(() => formatDate(new Date().toISOString()))

const langLanguages = computed(() =>
  lang.languages.map((l) => ({ label: `${l.flag}  ${l.nativeName}`, value: l.code }))
)

function onLanguage(code) {
  lang.setLanguage(code)
  $q.notify({ type: 'positive', message: t('options.saved') })
}

function onCalendar(v) {
  themeStore.patch({ calendar: v })
  themeStore.save()
}

function onMode(v) {
  themeStore.patch({ mode: v })
  themeStore.save()
}

function onPrimary(c) {
  themeStore.setCustomColor('primary', c)
  themeStore.save()
}

function onSidebar(v) {
  themeStore.patch({ sidebar: v })
  themeStore.save()
}
</script>

<style lang="sass" scoped>
.op-card
  border-radius: 14px
  border: 1px solid rgba(0, 0, 0, .08)
  background: #fff
  overflow: hidden
  height: 100%

  &__head
    display: flex
    align-items: center
    gap: 8px
    padding: 12px 16px
    border-bottom: 1px solid rgba(0, 0, 0, .06)
    font-size: 14px

  &__body
    padding: 8px 16px 14px

.op-row
  display: flex
  align-items: center
  justify-content: space-between
  gap: 12px
  padding: 12px 0
  border-bottom: 1px dashed rgba(0, 0, 0, .06)

  &:last-child
    border-bottom: none

  &__label
    font-size: 13px
    font-weight: 600

  &__hint
    font-size: 11px
    color: #9e9e9e
    margin-top: 2px

.op-dots
  display: flex
  gap: 8px

.op-dot
  width: 26px
  height: 26px
  border-radius: 50%
  border: 2px solid #fff
  box-shadow: 0 0 0 1px rgba(0, 0, 0, .2)
  cursor: pointer
  padding: 0

  &--on
    box-shadow: 0 0 0 2px var(--q-primary)

:global(.body--dark)
  .op-card
    background: $dark-page
    border-color: rgba(255, 255, 255, .12)

  .op-row__hint
    color: #a5a5a5

@media (max-width: 599px)
  .op-row
    flex-direction: column
    align-items: stretch
</style>
