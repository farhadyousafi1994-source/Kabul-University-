<template>
  <DataTablePage
    stats-module="campuses"
    :title="t('organization.campuses.title')"
    :subtitle="t('organization.campuses.subtitle')"
    icon="location_city"
    :entity-label="t('organization.campuses.entity')"
    :load="campusService.list"
    :columns="columns"
    perms="organization"
    :search-placeholder="`${t('common.search')}…`"
    :create-label="t('organization.campuses.add')"
    :empty-title="t('common.nothingHere')"
    :empty-message="t('common.noDataDesc')"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { campusService } from 'src/services/organization.service'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { t } = useI18n()

const columns = computed(() => [
  { name: 'code', label: t('common.code'), field: 'code', align: 'left' },
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'address', label: t('common.address'), field: 'address', align: 'left' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
])

const form = computed(() => ({
  fields: [
    { key: 'code', label: t('common.code'), type: 'text', required: true, hint: t('organization.campuses.codeHint') },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'address', label: t('common.address'), type: 'text' },
    { key: 'description', label: t('common.description'), type: 'textarea' },
    { key: 'status', label: t('common.status'), type: 'select', options: [{ label: t('status.active'), value: 'active' }, { label: t('status.inactive'), value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}))

const submit = async (values, editing) => (editing ? campusService.update(editing.id, values) : campusService.create(values))
const destroy = (row) => campusService.remove(row.id)
</script>
