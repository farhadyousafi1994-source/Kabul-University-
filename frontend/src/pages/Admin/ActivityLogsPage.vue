<template>
  <DataTablePage
    title="Activity Logs"
    subtitle="Audit trail of every important action"
    icon="receipt_long"
    entity-label="log entry"
    :load="load"
    :columns="columns"
    perms="audit"
    search-placeholder="Search module, entity or user…"
    :filters="[
      { key: 'module', label: 'Module', options: moduleOptions },
      { key: 'action', label: 'Action', options: actionOptions },
    ]"
    empty-title="No activity yet"
    empty-message="Actions across the system are recorded here."
  />
</template>

<script setup>
import DataTablePage from 'src/components/common/DataTablePage.vue'
import { activityLogService } from 'src/services/activity.service'
import { date } from 'src/utils/format'

const moduleOptions = [
  'Organization', 'Categories', 'Suppliers', 'Assets', 'Assignments', 'Transfers', 'Requests',
  'Maintenance', 'Incidents', 'Audits', 'Procurement', 'Warehouses', 'Depreciation', 'Disposals',
  'Users', 'Roles', 'Settings', 'Notifications',
].map((m) => ({ label: m, value: m }))

const actionOptions = [
  'created', 'updated', 'deleted', 'assigned', 'returned', 'transferred', 'approved', 'rejected',
  'completed', 'maintained', 'disposed', 'activated', 'deactivated', 'submitted', 'started',
  'verified', 'cancelled', 'sent', 'received', 'inspected', 'calculated', 'logged_in', 'logged_out',
].map((a) => ({ label: a, value: a }))

const load = (params) => activityLogService.list(params)

const columns = [
  { name: 'created_at', label: 'When', field: 'created_at', align: 'left', format: (v) => date(v, true) },
  { name: 'user_name', label: 'User', field: 'user_name', align: 'left' },
  { name: 'module', label: 'Module', field: 'module', align: 'left' },
  { name: 'action', label: 'Action', field: 'action', align: 'left' },
  { name: 'entity_label', label: 'Entity', field: 'entity_label', align: 'left' },
  { name: 'ip_address', label: 'IP', field: 'ip_address', align: 'left' },
]
</script>
