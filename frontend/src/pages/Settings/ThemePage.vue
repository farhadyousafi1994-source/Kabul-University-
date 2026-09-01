<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('theme.title')" :subtitle="t('theme.subtitle')" icon="palette" />

    <div class="tp-card">
      <!-- Header ----------------------------------------------------------->
      <div class="row items-center no-wrap q-pa-sm q-col-gutter-sm">
        <div class="col-auto tp-chip">
          <q-icon name="palette" size="18px" />
        </div>
        <div class="col">
          <div class="tp-title">{{ t('theme.appearance') }}</div>
        </div>
        <q-space />
        <q-btn outline no-caps dense icon="restart_alt" :label="t('theme.resetDefaults')" @click="onReset" />
      </div>

      <!-- Live preview ------------------------------------------------------>
      <div class="q-px-md q-pb-md">
        <div class="tp-preview">
          <div class="tp-preview__bar">
            <span class="tp-preview__brand">{{ t('common.universityName') }}</span>
            <span class="tp-preview__chip">{{ t('theme.rateChip') }}</span>
          </div>
          <div class="tp-preview__body">
            <div class="tp-mini-card">
              <div class="tp-mini-card__accent" />
              <div class="tp-mini-card__label">{{ t('theme.previewCardLabel') }}</div>
              <div class="tp-mini-card__value">{{ t('theme.previewCardValue') }}</div>
            </div>
            <q-btn unelevated no-caps :label="t('theme.save')" icon="check" @click="onSave" />
            <q-btn outline no-caps :label="t('theme.cancel')" @click="onCancel" :disable="!store.isDirty" />
            <q-chip dense color="positive" text-color="white">{{ t('theme.activeChip') }}</q-chip>
            <span class="tp-preview__txt">{{ t('theme.previewText') }}</span>
          </div>
        </div>
      </div>

      <!-- Color schemes ------------------------------------------------------>
      <div class="q-px-md q-pb-md">
        <div class="tp-sec">
          <q-icon name="format_paint" size="18px" />{{ t('theme.colorScheme') }}
        </div>
        <div class="row q-col-gutter-sm">
          <div v-for="s in store.schemes" :key="s.id" class="col-6 col-sm-4 col-md-2">
            <div class="tp-swatch" :class="{ 'tp-swatch--on': store.settings.schemeId === s.id && !store.settings.custom }" @click="store.setScheme(s.id)">
              <div class="tp-swatch__strip">
                <span v-for="(c, i) in s.colors" :key="i" :style="{ background: c }" />
              </div>
              <div class="tp-swatch__row">
                <span class="tp-swatch__name">{{ t(`theme.schemes.${s.id}`) }}</span>
                <q-icon v-if="store.settings.schemeId === s.id && !store.settings.custom" name="check_circle" size="16px" class="text-primary" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Fine tuning -------------------------------------------------------->
      <div class="q-px-md q-pb-md">
        <div class="tp-sec">
          <q-icon name="tune" size="18px" />{{ t('theme.fineTuning') }}
        </div>
        <div class="row q-col-gutter-sm">
          <div class="col-6 col-md-3">
            <div class="tp-set">
              <div class="tp-set__t"><q-icon name="brightness_6" size="15px" />{{ t('theme.displayMode') }}</div>
              <q-btn-toggle v-model="mode" unelevated spread dense :options="[
                { label: '☀', icon: 'light_mode', value: 'light', title: t('theme.light') },
                { label: '☾', icon: 'dark_mode', value: 'dark', title: t('theme.dark') },
              ]" @update:model-value="store.patch({ mode: $event })" />
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="tp-set">
              <div class="tp-set__t"><q-icon name="text_fields" size="15px" />{{ t('theme.fontSize') }}</div>
              <q-btn-toggle v-model="fontSize" unelevated spread dense no-caps
                :options="['S', 'M', 'L', 'XL'].map((v) => ({ label: v, value: v }))"
                @update:model-value="store.patch({ fontSize: $event })" />
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="tp-set">
              <div class="tp-set__t"><q-icon name="rounded_corner" size="15px" />{{ t('theme.radius') }}</div>
              <q-btn-toggle v-model="radius" unelevated spread dense no-caps :options="[
                { label: t('theme.sharp'), value: 'sharp' },
                { label: t('theme.normal'), value: 'normal' },
                { label: t('theme.round'), value: 'round' },
              ]" @update:model-value="store.patch({ radius: $event })" />
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="tp-set">
              <div class="tp-set__t"><q-icon name="view_sidebar" size="15px" />{{ t('theme.sidebar') }}</div>
              <q-btn-toggle v-model="sidebar" unelevated spread dense no-caps :options="[
                { label: 'Mini', value: 'mini' },
                { label: t('theme.normal'), value: 'normal' },
              ]" @update:model-value="store.patch({ sidebar: $event })" />
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="tp-set">
              <div class="tp-set__t"><q-icon name="event" size="15px" />{{ t('theme.calendar') }}</div>
              <q-btn-toggle v-model="calendar" unelevated spread dense no-caps :options="[
                { label: t('theme.gregorian'), value: 'gregorian' },
                { label: t('theme.solar'), value: 'solar' },
              ]" @update:model-value="store.patch({ calendar: $event })" />
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="tp-set">
              <div class="tp-set__t"><q-icon name="table_rows" size="15px" />{{ t('theme.tableDensity') }}</div>
              <q-btn-toggle v-model="density" unelevated spread dense no-caps :options="[
                { label: t('theme.compact'), value: 'compact' },
                { label: t('theme.loose'), value: 'loose' },
              ]" @update:model-value="store.patch({ density: $event })" />
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="tp-set">
              <div class="tp-set__t"><q-icon name="animation" size="15px" />{{ t('theme.animations') }}</div>
              <q-btn-toggle v-model="animation" unelevated spread dense no-caps :options="[
                { label: t('theme.on'), value: true },
                { label: t('theme.off'), value: false },
              ]" @update:model-value="store.patch({ animation: $event })" />
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="tp-set">
              <div class="tp-set__t"><q-icon name="colorize" size="15px" />{{ t('theme.primaryColor') }}</div>
              <div class="tp-quick">
                <button
                  v-for="c in store.quickColors" :key="c"
                  class="tp-quick__dot" :class="{ 'tp-quick__dot--on': store.colors.primary === c }"
                  :style="{ background: c }" :aria-label="c"
                  @click="store.setCustomColor('primary', c)"
                />
                <label class="tp-quick__dot tp-quick__dot--custom">
                  <q-icon name="add" size="13px" class="text-grey-7" />
                  <input type="color" :value="store.colors.primary" @input="onQuickCustom($event)" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Advanced color customization ---------------------------------------->
      <q-expansion-item
        v-model="advancedOpen"
        expand-separator
        :label="t('theme.advanced')"
        icon="palette"
        class="tp-adv"
        content-class="bg-transparent"
      >
        <div class="row q-col-gutter-md q-pa-md">
          <div v-for="p in pickers" :key="p.key" class="col-6 col-sm-4 col-md-2 tp-pick">
            <label class="tp-pick__swatch" :style="{ background: p.value }">
              <input type="color" :value="p.value" @input="onAdvanced(p.key, $event)" />
            </label>
            <div class="tp-pick__label">{{ t(`theme.adv.${p.key}`) }}</div>
            <div class="tp-pick__hex">{{ p.value.toUpperCase() }}</div>
          </div>
          <div class="col-12 col-md-2 flex items-center">
            <q-btn outline no-caps dense icon="undo" :label="t('theme.backToScheme')" @click="store.resetCustom()" :disable="!store.settings.custom" />
          </div>
        </div>
      </q-expansion-item>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import { useThemeStore } from 'src/stores/theme'

const { t } = useI18n()
const $q = useQuasar()
const store = useThemeStore()

const advancedOpen = ref(false)

// Convenience refs bound to the store so the btn-toggle groups can v-model.
const mode = computed(() => store.settings.mode)
const fontSize = computed(() => store.settings.fontSize)
const radius = computed(() => store.settings.radius)
const sidebar = computed(() => store.settings.sidebar)
const calendar = computed(() => store.settings.calendar)
const density = computed(() => store.settings.density)
const animation = computed(() => store.settings.animation)

const pickers = computed(() => [
  { key: 'headerFrom', value: store.colors.headerFrom },
  { key: 'headerTo', value: store.colors.headerTo },
  { key: 'primary', value: store.colors.primary },
  { key: 'accent', value: store.colors.accent },
  { key: 'accentBg', value: store.colors.accentBg },
])

function onQuickCustom(e) {
  store.setCustomColor('primary', e.target.value)
}

function onAdvanced(key, e) {
  store.setCustomColor(key, e.target.value)
}

function onSave() {
  store.save()
  $q.notify({ type: 'positive', message: t('theme.saved') })
}

function onCancel() {
  store.cancel()
  $q.notify({ type: 'info', message: t('theme.cancelled') })
}

function onReset() {
  $q.dialog({
    title: t('theme.resetTitle'),
    message: t('theme.resetMessage'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    store.reset()
    store.save()
    $q.notify({ type: 'positive', message: t('theme.saved') })
  })
}

// Warn before leaving with unsaved changes.
watch(() => store.isDirty, (dirty) => {
  const handler = (e) => {
    if (dirty) {
      e.preventDefault()
      e.returnValue = ''
    }
  }
  if (dirty) window.addEventListener('beforeunload', handler)
  else window.removeEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
})

onMounted(() => store.applyInitial())
onBeforeUnmount(() => window.removeEventListener('beforeunload', () => {}))
</script>

<style lang="sass" scoped>
.tp-card
  border-radius: 14px
  border: 1px solid rgba(0, 0, 0, .08)
  background: #fff
  overflow: hidden

.tp-chip
  width: 38px
  height: 38px
  border-radius: 10px
  display: flex
  align-items: center
  justify-content: center
  color: #fff
  background: linear-gradient(135deg, var(--ku-header-from, $primary), var(--ku-header-to, $secondary))

.tp-title
  font-size: 16px
  font-weight: 700

.tp-preview
  border-radius: 12px
  overflow: hidden
  border: 1px solid rgba(0, 0, 0, .08)

  &__bar
    display: flex
    align-items: center
    justify-content: space-between
    gap: 10px
    padding: 9px 14px
    color: #fff
    background: linear-gradient(115deg, var(--ku-header-from, $primary) 0%, var(--ku-header-to, $secondary) 100%)

  &__brand
    font-size: 13px
    font-weight: 700

  &__chip
    font-size: 10px
    padding: 2px 10px
    border-radius: 10px
    background: rgba(255, 255, 255, .18)
    border: 1px solid rgba(255, 255, 255, .3)

  &__body
    display: flex
    flex-wrap: wrap
    align-items: center
    gap: 10px
    padding: 14px
    background: var(--ku-accent-bg, #E8F5E9)

  &__txt
    font-size: 12px
    color: rgba(0, 0, 0, .55)

.tp-mini-card
  position: relative
  min-width: 150px
  padding: 12px 14px
  border-radius: 10px
  background: #fff
  border: 1px solid rgba(0, 0, 0, .07)
  overflow: hidden

  &__accent
    position: absolute
    inset-inline-start: 0
    top: 0
    bottom: 0
    width: 4px
    background: var(--q-primary)

  &__label
    font-size: 11px
    color: #757575

  &__value
    font-size: 20px
    font-weight: 700
    color: var(--q-primary)

.tp-sec
  display: flex
  align-items: center
  gap: 8px
  font-size: 14px
  font-weight: 700
  margin-bottom: 10px

  .q-icon
    color: var(--q-primary)

.tp-swatch
  border-radius: 12px
  border: 2px solid transparent
  background: #fff
  box-shadow: 0 0 0 1px rgba(0, 0, 0, .08)
  cursor: pointer
  overflow: hidden
  transition: transform .12s ease

  &:hover
    transform: translateY(-2px)

  &--on
    border-color: var(--q-primary)

  &__strip
    display: flex
    height: 34px

    span
      flex: 1

  &__row
    display: flex
    align-items: center
    justify-content: space-between
    padding: 6px 10px

  &__name
    font-size: 11px
    font-weight: 600

.tp-set
  border-radius: 12px
  border: 1px solid rgba(0, 0, 0, .07)
  background: #fff
  padding: 10px
  height: 100%

  &__t
    display: flex
    align-items: center
    gap: 6px
    font-size: 12px
    font-weight: 600
    color: rgba(0, 0, 0, .65)
    margin-bottom: 8px

  .q-btn-toggle
    width: 100%
    border-radius: 10px
    overflow: hidden

    .q-btn
      font-size: 11px
      text-transform: none

.tp-quick
  display: flex
  flex-wrap: wrap
  gap: 8px
  align-items: center

  &__dot
    position: relative
    width: 26px
    height: 26px
    border-radius: 50%
    border: 2px solid #fff
    box-shadow: 0 0 0 1px rgba(0, 0, 0, .18)
    cursor: pointer
    display: flex
    align-items: center
    justify-content: center
    padding: 0

    &--on
      box-shadow: 0 0 0 2px var(--q-primary)

    &--custom
      background: #fff !important
      box-shadow: 0 0 0 1px dashed rgba(0, 0, 0, .35)

      input
        position: absolute
        inset: 0
        opacity: 0
        cursor: pointer

.tp-pick
  &__swatch
    position: relative
    display: block
    height: 46px
    border-radius: 10px
    cursor: pointer
    overflow: hidden
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .12)

    input
      position: absolute
      inset: 0
      opacity: 0
      cursor: pointer

  &__label
    font-size: 11px
    font-weight: 600
    margin-top: 8px

  &__hex
    font-size: 10px
    color: #9e9e9e
    direction: ltr

.tp-adv
  margin-top: 8px

  :deep(.q-expansion-item__container)
    border-top: 1px solid rgba(0, 0, 0, .06)

// Dark mode
:global(.body--dark)
  .tp-card
    background: $dark-page
    border-color: rgba(255, 255, 255, .12)

  .tp-swatch,
  .tp-set,
  .tp-mini-card
    background: #1e1e1e

  .tp-preview__body
    background: #1e1e1e

  .tp-preview__txt
    color: #b0b0b0

@media (max-width: 599px)
  .tp-preview__body
    gap: 8px
</style>
