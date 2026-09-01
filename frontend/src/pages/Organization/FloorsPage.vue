<template>
  <DataTablePage
    :title="t('organization.floors.title')"
    :subtitle="t('organization.floors.subtitle')"
    icon="stairs"
    :entity-label="t('organization.floors.entity')"
    :load="floorService.list"
    :columns="columns"
    perms="organization"
    :search-placeholder="`${t('common.search')}…`"
    :create-label="t('organization.floors.add')"
    :empty-title="t('common.nothingHere')"
    :empty-message="t('common.noDataDesc')"
    :filters="[{ key: 'building_id', label: t('common.building'), options: buildingOptions, loading: buildingsLoading }]"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { floorService } from 'src/services/organization.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { t } = useI18n()
const { buildings, opts } = useOptions()
const buildingOptions = computed(() => opts(buildings.value))
const buildingsLoading = computed(() => !buildings.value.length)

const columns = computed(() => [
  { name: 'code', label: t('common.code'), field: 'code', align: 'left' },
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'level', label: t('organization.floors.floorNumber'), field: 'level', align: 'left' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
])

const form = computed(() => ({
  fields: [
    { key: 'building_id', label: t('common.building'), type: 'select', options: buildingOptions.value, required: true },
    { key: 'code', label: t('common.code'), type: 'text', required: true, hint: 'e.g. FL-1' },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'level', label: t('organization.floors.floorNumber'), type: 'number', required: true },
    { key: 'status', label: t('common.status'), type: 'select', options: [{ label: t('status.active'), value: 'active' }, { label: t('status.inactive'), value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active', level: 1 },
}))

const submit = async (values, editing) => (editing ? floorService.update(editing.id, values) : floorService.create(values))
const destroy = (row) => floorService.remove(row.id)
</script>
