<template>
  <q-chip
    :color="color"
    text-color="white"
    size="sm"
    dense
    :class="pill ? 'pill-badge' : ''"
  >
    {{ label }}
  </q-chip>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Colored status/condition badge. The color map is centralized here so all
 * modules render identical chips for identical statuses.
 */
const props = defineProps({
  value: { type: String, required: true },
  label: { type: String, default: '' },
  pill: { type: Boolean, default: false },
})

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
const label = computed(() => props.label || MAP[props.value]?.[1] || props.value.replace(/_/g, ' '))
</script>

<style lang="sass">
.pill-badge
  border-radius: 999px
</style>
