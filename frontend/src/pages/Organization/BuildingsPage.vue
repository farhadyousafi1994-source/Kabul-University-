<template>
  <DataTablePage
    stats-module="buildings"
    :title="t('organization.buildings.title')"
    :subtitle="t('organization.buildings.subtitle')"
    icon="apartment"
    :entity-label="t('organization.buildings.entity')"
    :load="buildingService.list"
    :columns="columns"
    perms="organization"
    :search-placeholder="`${t('common.search')}…`"
    :create-label="t('organization.buildings.add')"
    :empty-title="t('common.nothingHere')"
    :empty-message="t('common.noDataDesc')"
    :filters="[{ key: 'campus_id', label: t('common.campus'), options: campusOptions, loading: campusesLoading }]"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildingService } from 'src/services/organization.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { t } = useI18n()
const { campuses, opts } = useOptions()
const campusOptions = computed(() => opts(campuses.value))
const campusesLoading = computed(() => !campuses.value.length)

const columns = computed(() => [
  { name: 'code', label: t('common.code'), field: 'code', align: 'left' },
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'description', label: t('common.description'), field: 'description', align: 'left' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
])

const form = computed(() => ({
  fields: [
    { key: 'campus_id', label: t('common.campus'), type: 'select', options: campusOptions.value, required: true },
    { key: 'code', label: t('common.code'), type: 'text', required: true, hint: 'e.g. BLD-CS' },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'description', label: t('common.description'), type: 'textarea' },
    { key: 'status', label: t('common.status'), type: 'select', options: [{ label: t('status.active'), value: 'active' }, { label: t('status.inactive'), value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}))

const submit = async (values, editing) => (editing ? buildingService.update(editing.id, values) : buildingService.create(values))
const destroy = (row) => buildingService.remove(row.id)
</script>
