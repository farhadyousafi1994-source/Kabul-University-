<template>
  <q-chip
    :color="color"
    text-color="white"
    size="sm"
    dense
    :class="pill ? 'pill-badge' : ''"
  >
    {{ displayLabel }}
  </q-chip>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Colored status/condition badge. The color map is centralized here so all
 * modules render identical chips for identical statuses with dynamic i18n support.
 */
const props = defineProps({
  value: { type: String, required: true },
  label: { type: String, default: '' },
  pill: { type: Boolean, default: false },
})

const { t, te } = useI18n()

const MAP = {
  // Asset statuses
  available: ['positive', 'Available'],
  assigned: ['info', 'Assigned'],
  reserved: ['primary', 'Reserved'],
  under_maintenance: ['warning', 'Under Maintenance'],
  damaged: ['deep-orange', 'Damaged'],
  lost: ['grey-8', 'Lost'],
  stolen: ['brown', 'Stolen'],
  disposed: ['grey-6', 'Disposed'],
  retired: ['blue-grey', 'Retired'],
  // Conditions
  excellent: ['teal', 'Excellent'],
  good: ['positive', 'Good'],
  fair: ['warning', 'Fair'],
  poor: ['deep-orange', 'Poor'],
  // Users / records
  active: ['positive', 'Active'],
  inactive: ['grey-6', 'Inactive'],
  leave: ['orange', 'On Leave'],
  on_leave: ['orange', 'On Leave'],
  deactivated: ['grey-6', 'Deactivated'],
  // Assignments
  overdue: ['negative', 'Overdue'],
  returned: ['teal', 'Returned'],
  // Transfer / request / approval workflows
  draft: ['grey-6', 'Draft'],
  requested: ['info', 'Requested'],
  submitted: ['info', 'Submitted'],
  approved: ['positive', 'Approved'],
  rejected: ['negative', 'Rejected'],
  in_transit: ['warning', 'In Transit'],
  completed: ['positive', 'Completed'],
  cancelled: ['grey-6', 'Cancelled'],
  in_progress: ['warning', 'In Progress'],
  pending: ['warning', 'Pending'],
  verified: ['positive', 'Verified'],
  missing: ['negative', 'Missing'],
  wrong_location: ['deep-orange', 'Wrong Location'],
  sold: ['teal', 'Sold'],
  donated: ['indigo', 'Donated'],
  recycled: ['green-7', 'Recycled'],
  destroyed: ['brown', 'Destroyed'],
}

const color = computed(() => MAP[props.value]?.[0] || 'grey-7')

const displayLabel = computed(() => {
  if (props.label) return props.label
  const val = props.value
  if (te(`status.${val}`)) return t(`status.${val}`)
  if (te(`condition.${val}`)) return t(`condition.${val}`)
  if (te(`common.${val}`)) return t(`common.${val}`)
  return MAP[val]?.[1] || val.replace(/_/g, ' ')
})
</script>

<style lang="sass">
.pill-badge
  border-radius: 999px
</style>
