<template>
  <div class="ab-bar">
    <div class="ab-bar__group">
      <template v-for="a in actions" :key="a.key">
        <ActionButton
          v-if="a.show !== false"
          :icon="a.mdi ? `mdi ${a.icon}` : a.icon"
          :label="a.label"
          :variant="variantFor(a)"
          :disable="Boolean(a.disabled)"
          :loading="Boolean(a.loading)"
          :tooltip="a.tooltip || a.label"
          @click="a.handler"
        />
      </template>
    </div>

    <ExportActions
      v-if="rows"
      :rows="rows"
      :columns="columns || []"
      :filename="filename"
      :title="title"
      :print-selector="printSelector"
    />
  </div>
</template>

<script setup>
/**
 * Table action bar — page actions on the left, Print / PDF / Excel on the right.
 *
 * The buttons are the shared <ActionButton>, so the bar inherits the single
 * application button voice (consistent height, padding, radius, hover, focus)
 * instead of the circular icon buttons it used to draw itself. The `actions`
 * prop shape is unchanged, so every existing page keeps working; an action can
 * now additionally declare `variant`, `loading` and `tooltip`.
 */
import ActionButton from './ActionButton.vue'
import ExportActions from './ExportActions.vue'

const props = defineProps({
  /** Left-side actions: { key, icon, mdi?, label, color?, variant?, disabled?, loading?, show?, handler }. */
  actions: { type: Array, default: () => [] },
  /** Current page rows — enables the Print / PDF / Excel group. */
  rows: { type: Array, default: null },
  columns: { type: Array, default: null },
  filename: { type: String, default: 'Report' },
  title: { type: String, default: '' },
  printSelector: { type: String, default: '.print-area' },
})

/**
 * Legacy `color` values are mapped onto the four intents so pages that still
 * pass `color: 'primary'` / `'negative'` keep their meaning.
 */
function variantFor(a) {
  if (a.variant) return a.variant
  if (a.color === 'primary' || a.key === 'create' || a.key === 'add') return 'primary'
  if (a.color === 'negative' || a.color === 'red') return 'danger'
  return 'secondary'
}
</script>

<style lang="sass" scoped>
.ab-bar
  display: flex
  align-items: center
  justify-content: space-between
  gap: 10px
  flex-wrap: wrap
  margin-bottom: 12px

  &__group
    display: flex
    align-items: center
    gap: 8px
    flex-wrap: wrap
</style>
