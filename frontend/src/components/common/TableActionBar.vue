<template>
  <div class="ab-bar">
    <div class="row items-center q-gutter-x-sm">
      <template v-for="a in actions" :key="a.key">
        <button
          v-if="a.show !== false"
          type="button"
          class="ab-btn"
          :class="[`text-${a.color || 'teal'}`]"
          :disabled="!!a.disabled"
          @click="a.handler"
        >
          <span class="ab-btn__circle">
            <q-icon :name="a.mdi ? `mdi ${a.icon}` : a.icon" size="18px" />
          </span>
          <span v-if="a.label" class="ab-btn__label desktop-only q-ml-sm">{{ a.label }}</span>
        </button>
      </template>
    </div>

    <div class="row items-center q-gutter-x-sm">
      <button
        v-if="rows"
        type="button"
        class="ab-btn text-blue-grey-8"
        :disabled="!rows.length"
        @click="printArea('.print-area')"
      >
        <span class="ab-btn__circle"><q-icon name="print" size="18px" /></span>
        <span class="ab-btn__label desktop-only q-ml-sm">{{ t('common.print') }}</span>
      </button>
      <button
        v-if="rows"
        type="button"
        class="ab-btn text-red-7"
        :disabled="!rows.length"
        @click="printArea('.print-area')"
      >
        <span class="ab-btn__circle"><q-icon name="mdi mdi-file-pdf-box" size="18px" /></span>
        <span class="ab-btn__label desktop-only q-ml-sm">{{ t('common.pdf') }}</span>
      </button>
      <button
        v-if="rows"
        type="button"
        class="ab-btn text-green-8"
        :disabled="!rows.length"
        @click="doExcel"
      >
        <span class="ab-btn__circle"><q-icon name="mdi mdi-microsoft-excel" size="18px" /></span>
        <span class="ab-btn__label desktop-only q-ml-sm">{{ t('common.excel') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { downloadExcel, printArea, stamp } from 'src/utils/export'

const props = defineProps({
  /**
   * Left-side actions, in order. Each: { key, icon, mdi?, label, color,
   * disabled?, show?, handler }.
   */
  actions: { type: Array, default: () => [] },
  /** Current page rows — enables the built-in Print / PDF / Excel buttons. */
  rows: { type: Array, default: null },
  /** Export columns: same shape as q-table columns (name/label/format). */
  columns: { type: Array, default: null },
  /** Base file name for downloads. */
  filename: { type: String, default: 'ku-ams-export' },
})

const { t } = useI18n()

function doExcel() {
  const cols = (props.columns || []).filter((c) => c.name !== 'actions' && c.name !== 'select' && c.field !== 'id')
  downloadExcel(`${props.filename}-${stamp()}`, props.rows, cols.length ? cols : null)
}
</script>

<style lang="sass" scoped>
.ab-bar
  display: flex
  align-items: center
  justify-content: space-between
  gap: 10px
  flex-wrap: wrap
  margin-top: 4px
  margin-bottom: 10px

  .row
    flex-wrap: wrap

.ab-btn
  display: inline-flex
  align-items: center
  border: none
  background: transparent
  padding: 6px 10px
  cursor: pointer
  border-radius: 8px
  transition: background .15s ease, transform .15s ease

  &:hover:not(:disabled)
    background: rgba(0, 0, 0, .05)
    transform: translateY(-1px)

  &:disabled
    opacity: .45
    cursor: not-allowed

  &__circle
    width: 34px
    height: 34px
    border-radius: 50%
    display: flex
    align-items: center
    justify-content: center
    box-shadow: 0 4px 10px rgba(0, 0, 0, .18)
    background: color-mix(in srgb, currentColor 14%, #fff)
    border: 2px solid currentColor

    .q-icon
      font-size: 18px

  &__label
    font-size: 13px
    font-weight: 700
    color: inherit

:global(.body--dark)
  .ab-btn
    &:hover:not(:disabled)
      background: rgba(255, 255, 255, .08)

    .ab-btn__circle
      background: color-mix(in srgb, currentColor 25%, #1e1e1e)
</style>
