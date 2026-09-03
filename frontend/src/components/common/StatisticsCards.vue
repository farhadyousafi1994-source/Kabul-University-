<template>
  <section v-if="cards.length" class="stat-strip print-hide" :aria-label="t('stats.sectionLabel')">
    <div class="stat-strip__grid">
      <StatisticCard
        v-for="c in cards"
        :key="c.key"
        :label="c.label"
        :value="c.value"
        :icon="c.icon"
        :color="c.color"
        :format="c.format"
        :hint="c.hint"
        :loading="loading"
        :interactive="Boolean(c.filter)"
        :active="isActive(c)"
        @select="toggle(c)"
      />
    </div>

    <div class="stat-strip__foot">
      <span class="stat-strip__scope">
        <q-icon :name="filtered ? 'filter_alt' : 'select_all'" size="14px" />
        {{ filtered ? t('stats.showingFiltered') : t('stats.showingAll') }}
      </span>
      <q-btn
        v-if="activeKey"
        flat
        dense
        no-caps
        size="sm"
        color="primary"
        icon="close"
        :label="t('stats.clearCardFilter')"
        @click="clear"
      />
    </div>
  </section>
</template>

<script setup>
/**
 * ---------------------------------------------------------------------------
 * StatisticsCards — the summary strip that sits above every data table.
 * ---------------------------------------------------------------------------
 *
 * A page only names its module; labels, icons, colours and click-to-filter
 * behaviour come from `src/config/statistics.js`, and the numbers from one
 * aggregated API call (`useStatistics`, debounced + cached + cancellable).
 *
 *   <StatisticsCards module="assets" :filters="filters" v-model:active="card" />
 *
 * Clicking a card emits `filter` with the filter patch (or `null` to clear) —
 * the page applies it to its own filter state, so the table and the cards can
 * never fall out of sync and nothing ever reloads the page.
 */
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import StatisticCard from './StatisticCard.vue'
import { cardsFor } from 'src/config/statistics'
import { useStatistics } from 'src/composables/useStatistics'

const props = defineProps({
  /** Statistics module name, e.g. 'assets' (see src/config/statistics.js). */
  module: { type: String, required: true },
  /** The page's active filters — the cards describe the same subset. */
  filters: { type: Object, default: () => ({}) },
  /** Key of the currently selected card (v-model:active). */
  active: { type: String, default: '' },
  /** Bumped by the page's Refresh button to force a re-fetch. */
  refreshKey: { type: [Number, String], default: 0 },
})

const emit = defineEmits(['update:active', 'filter', 'loaded'])

const { t, te } = useI18n()

const { stats, loading, filtered, refresh } = useStatistics(
  computed(() => props.module),
  () => props.filters,
)

watch(() => props.refreshKey, () => refresh())
watch(stats, (value) => emit('loaded', value))

const total = computed(() => Number(stats.value?.total ?? 0))

const cards = computed(() =>
  cardsFor(props.module)
    // Only render a card the API actually answered with — a module that gains
    // a counter later starts showing it with no frontend change, and one that
    // does not provide it never renders an empty box.
    .filter((c) => stats.value?.[c.key] !== undefined)
    .map((c) => ({
      ...c,
      label: te(c.labelKey) ? t(c.labelKey) : c.key,
      value: stats.value[c.key],
      hint: hintFor(c),
    })),
)

/** "of 1,250 total" — context that turns a bare number into information. */
function hintFor(c) {
  if (c.key === 'total' || c.format === 'currency' || !total.value) return ''
  const value = Number(stats.value[c.key]) || 0
  const share = Math.round((value / total.value) * 100)
  return t('stats.ofTotal', { percent: share, total: total.value.toLocaleString() })
}

const activeKey = computed(() => props.active)

const isActive = (c) => Boolean(c.filter) && props.active === c.key

function toggle(c) {
  if (!c.filter) return
  if (props.active === c.key) return clear()
  emit('update:active', c.key)
  emit('filter', { ...c.filter })
}

function clear() {
  emit('update:active', '')
  emit('filter', null)
}

defineExpose({ refresh })
</script>

<style lang="sass" scoped>
.stat-strip
  margin-bottom: 12px

  &__grid
    display: grid
    gap: 12px
    // Responsive by construction: 4+ per row on desktop, 2 on tablet, 1 on
    // phones — no breakpoint list to keep in sync.
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr))

  &__foot
    display: flex
    align-items: center
    gap: 8px
    margin-top: 8px
    min-height: 24px

  &__scope
    display: inline-flex
    align-items: center
    gap: 4px
    font-size: 11px
    font-weight: 600
    color: var(--app-text-secondary)

@media (max-width: 599px)
  .stat-strip__grid
    grid-template-columns: 1fr
</style>
