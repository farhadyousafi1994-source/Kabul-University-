<template>
  <header class="page-head print-hide">
    <div class="page-head__row">
      <div class="page-head__lead">
        <BackButton v-if="showBack" :fallback="backFallback" class="page-head__back" />

        <div class="page-head__titles">
          <nav v-if="crumbs.length" class="page-head__crumbs" :aria-label="t('common.breadcrumb')">
            <template v-for="(crumb, i) in crumbs" :key="i">
              <router-link v-if="crumb.to" :to="crumb.to" class="page-head__crumb">{{ crumb.label }}</router-link>
              <span v-else class="page-head__crumb page-head__crumb--current">{{ crumb.label }}</span>
              <q-icon v-if="i < crumbs.length - 1" name="chevron_right" size="14px" class="page-head__crumb-sep" />
            </template>
          </nav>

          <div class="page-head__title-row">
            <span v-if="icon" class="page-head__icon"><q-icon :name="icon" size="22px" /></span>
            <div class="min-width-0">
              <h1 class="page-head__title">{{ title }}</h1>
              <p v-if="subtitle" class="page-head__subtitle">{{ subtitle }}</p>
            </div>
          </div>

          <div v-if="resolvedMeta.length" class="page-head__meta">
            <span v-for="(m, i) in resolvedMeta" :key="i" class="page-head__chip">
              <q-icon v-if="m.icon" :name="m.icon" size="13px" />
              {{ m.label }}
            </span>
          </div>
        </div>
      </div>

      <div class="page-head__actions">
        <slot name="actions" />
        <RefreshButton v-if="onRefresh" :handler="onRefresh" :loading="refreshing" :silent="silentRefresh" />
      </div>
    </div>
  </header>
</template>

<script setup>
/**
 * ---------------------------------------------------------------------------
 * PageHeader — the one header every page wears.
 * ---------------------------------------------------------------------------
 *
 *   left   Back button (when applicable) · breadcrumb · title · subtitle · meta
 *   right  page actions (Add / Create / Print / Export / Import) + Refresh
 *
 * Actions are passed through the `actions` slot as <ActionButton>s so the whole
 * application shares one button voice, and Refresh is built in (pass
 * `:on-refresh`) so it is placed and styled identically on every page.
 *
 * On phones the action row wraps under the title instead of squeezing it.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BackButton from './BackButton.vue'
import RefreshButton from './RefreshButton.vue'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  /** Breadcrumb trail: [{ label, to? }] — the last entry is the current page. */
  breadcrumbs: { type: Array, default: () => [] },
  /** Show the Back button (detail pages, nested views). */
  showBack: { type: Boolean, default: false },
  /** Where Back goes when there is no history (deep link / fresh tab). */
  backFallback: { type: [String, Object], default: () => ({ name: 'dashboard' }) },
  /** Metadata chips under the title: 'text' or { icon, label }. */
  meta: { type: Array, default: () => [] },
  /** Async reload handler — renders the standard Refresh button when given. */
  onRefresh: { type: Function, default: null },
  refreshing: { type: Boolean, default: false },
  silentRefresh: { type: Boolean, default: false },
})

const { t } = useI18n()

const crumbs = computed(() => props.breadcrumbs.filter((c) => c && c.label))

const resolvedMeta = computed(() =>
  props.meta.map((m) => (typeof m === 'string' ? { label: m } : m)).filter((m) => m && m.label),
)
</script>

<style lang="sass" scoped>
.min-width-0
  min-width: 0

.page-head
  background: var(--app-card)
  border: 1px solid var(--app-border)
  border-radius: var(--app-radius-lg)
  padding: 14px 16px
  margin-bottom: 14px
  box-shadow: 0 1px 2px rgba(16, 24, 40, .04)

  &__row
    display: flex
    align-items: flex-start
    justify-content: space-between
    gap: 12px
    flex-wrap: wrap

  &__lead
    display: flex
    align-items: flex-start
    gap: 12px
    min-width: 0
    flex: 1

  &__back
    margin-top: 2px

  &__titles
    min-width: 0

  &__crumbs
    display: flex
    align-items: center
    gap: 4px
    flex-wrap: wrap
    margin-bottom: 3px

  &__crumb
    font-size: 11px
    font-weight: 600
    color: var(--app-link)
    text-decoration: none

    &:hover
      text-decoration: underline

    &--current
      color: var(--app-text-secondary)

  &__crumb-sep
    color: var(--app-text-secondary)

  &__title-row
    display: flex
    align-items: center
    gap: 10px
    min-width: 0

  &__icon
    display: flex
    align-items: center
    justify-content: center
    width: 38px
    height: 38px
    min-width: 38px
    border-radius: var(--app-radius)
    background: color-mix(in srgb, var(--q-primary) 12%, transparent)
    color: var(--q-primary)

  &__title
    margin: 0
    font-size: 19px
    font-weight: 700
    line-height: 1.25
    letter-spacing: -.2px
    color: var(--app-text-primary)

  &__subtitle
    margin: 2px 0 0
    font-size: 12.5px
    color: var(--app-text-secondary)

  &__meta
    display: flex
    flex-wrap: wrap
    gap: 6px
    margin-top: 7px

  &__chip
    display: inline-flex
    align-items: center
    gap: 4px
    font-size: 11px
    font-weight: 600
    padding: 2px 8px
    border-radius: 999px
    background: var(--app-hover)
    color: var(--app-text-secondary)

  &__actions
    display: flex
    align-items: center
    gap: 8px
    flex-wrap: wrap

@media (max-width: 599px)
  .page-head
    padding: 12px

    &__actions
      width: 100%

    &__title
      font-size: 17px
</style>
