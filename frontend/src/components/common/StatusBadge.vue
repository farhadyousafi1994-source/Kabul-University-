<template>
  <span class="app-badge" :class="[`app-badge--${intent}`, { 'app-badge--square': !pill }]">
    <span v-if="dot" class="app-badge__dot" aria-hidden="true" />
    {{ displayLabel }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { STATUS_INTENTS } from 'src/config/themes'

/**
 * Status / condition badge.
 *
 * The status → MEANING map is centralised (src/config/themes.js) and the
 * meaning → colour map lives in the design system, so every module renders
 * identical badges for identical statuses:
 *
 *   Active / Approved / Completed → green
 *   Pending / In progress         → amber
 *   Inactive / Draft              → grey
 *   Cancelled / Rejected / Overdue→ red
 *   Assigned / Requested / Info   → blue
 *
 * Badges are soft-tinted (not solid) so long tables stay calm and readable in
 * both light and dark mode, and they carry the label in the active language.
 */
const props = defineProps({
  value: { type: String, required: true },
  label: { type: String, default: '' },
  /** Rounded pill (default) or slightly squared badge. */
  pill: { type: Boolean, default: true },
  /** Show the leading status dot. */
  dot: { type: Boolean, default: true },
})

const { t, te } = useI18n()

/** Extra domain statuses that are not in the shared status→intent map. */
const EXTRA_INTENTS = {
  excellent: 'success',
  good: 'success',
  fair: 'warning',
  poor: 'danger',
  lost: 'danger',
  stolen: 'danger',
  retired: 'neutral',
  deactivated: 'neutral',
  leave: 'warning',
  on_leave: 'warning',
  wrong_location: 'warning',
  sold: 'view',
  donated: 'info',
  recycled: 'success',
  destroyed: 'danger',
}

const FALLBACK_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  reserved: 'Reserved',
  under_maintenance: 'Under Maintenance',
  damaged: 'Damaged',
  lost: 'Lost',
  stolen: 'Stolen',
  disposed: 'Disposed',
  retired: 'Retired',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  active: 'Active',
  inactive: 'Inactive',
  leave: 'On Leave',
  on_leave: 'On Leave',
  deactivated: 'Deactivated',
  overdue: 'Overdue',
  returned: 'Returned',
  draft: 'Draft',
  requested: 'Requested',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  in_transit: 'In Transit',
  completed: 'Completed',
  cancelled: 'Cancelled',
  in_progress: 'In Progress',
  pending: 'Pending',
  verified: 'Verified',
  missing: 'Missing',
  wrong_location: 'Wrong Location',
  sold: 'Sold',
  donated: 'Donated',
  recycled: 'Recycled',
  destroyed: 'Destroyed',
}

const intent = computed(() => STATUS_INTENTS[props.value] || EXTRA_INTENTS[props.value] || 'neutral')

const displayLabel = computed(() => {
  if (props.label) return props.label
  const val = props.value
  if (te(`status.${val}`)) return t(`status.${val}`)
  if (te(`condition.${val}`)) return t(`condition.${val}`)
  if (te(`common.${val}`)) return t(`common.${val}`)
  return FALLBACK_LABELS[val] || String(val).replace(/_/g, ' ')
})
</script>

<style lang="sass" scoped>
.app-badge--square
  border-radius: var(--app-radius-sm)
</style>
