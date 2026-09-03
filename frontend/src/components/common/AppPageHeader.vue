<template>
  <PageHeader
    :title="title"
    :subtitle="subtitle"
    :icon="icon"
    :meta="meta"
    :breadcrumbs="breadcrumbs"
    :show-back="showBack"
    :back-fallback="backFallback"
    :on-refresh="onRefresh"
    :refreshing="refreshing"
  >
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
  </PageHeader>
</template>

<script setup>
/**
 * AppPageHeader — kept as the historical name so every existing page keeps
 * working, but it is now a thin pass-through to the unified <PageHeader>.
 * That is what gives the whole application ONE header (back button, breadcrumb,
 * title, meta chips, action row, refresh) without touching 28 page templates.
 *
 * New pages should import PageHeader directly.
 */
import PageHeader from './PageHeader.vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  /** Metadata chips shown under the subtitle: 'text' or { icon, label }. */
  meta: { type: Array, default: () => [] },
  breadcrumbs: { type: Array, default: () => [] },
  showBack: { type: Boolean, default: false },
  backFallback: { type: [String, Object], default: () => ({ name: 'dashboard' }) },
  onRefresh: { type: Function, default: null },
  refreshing: { type: Boolean, default: false },
})
</script>
