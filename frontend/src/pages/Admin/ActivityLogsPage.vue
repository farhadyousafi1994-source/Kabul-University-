<template>
  <DataTablePage
    stats-module="activity"
    :title="t('admin.activityLogs.title')"
    :subtitle="t('admin.activityLogs.subtitle')"
    icon="receipt_long"
    entity-label="log entry"
    :load="load"
    :columns="columns"
    perms="audit"
    :search-placeholder="`${t('common.search')}…`"
    :filters="[
      { key: 'module', label: 'Module', options: moduleOptions },
      { key: 'action', label: t('admin.activityLogs.action'), options: actionOptions },
    ]"
    :empty-title="t('dashboard.noRecentActivity')"
    :empty-message="t('common.noDataDesc')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTablePage from 'src/components/common/DataTablePage.vue'
import { activityLogService } from 'src/services/activity.service'
import { date } from 'src/utils/format'

const { t } = useI18n()

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

const columns = computed(() => [
  { name: 'created_at', label: t('admin.activityLogs.timestamp'), field: 'created_at', align: 'left', format: (v) => date(v, true) },
  { name: 'user_name', label: t('common.user'), field: 'user_name', align: 'left' },
  { name: 'module', label: 'Module', field: 'module', align: 'left' },
  { name: 'action', label: t('admin.activityLogs.action'), field: 'action', align: 'left' },
  { name: 'entity_label', label: t('admin.activityLogs.entity'), field: 'entity_label', align: 'left' },
  { name: 'ip_address', label: t('admin.activityLogs.ipAddress'), field: 'ip_address', align: 'left' },
])
</script>
