<template>
  <DataTablePage
    title="Floors"
    subtitle="Floors within buildings"
    icon="stairs"
    entity-label="floor"
    :load="floorService.list"
    :columns="columns"
    perms="organization"
    search-placeholder="Search by code or name…"
    create-label="Add Floor"
    empty-title="No floors yet"
    empty-message="Floors sit under buildings."
    :filters="[{ key: 'building_id', label: 'Building', options: buildingOptions, loading: buildingsLoading }]"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { floorService } from 'src/services/organization.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { buildings, opts } = useOptions()
const buildingOptions = computed(() => opts(buildings.value))
const buildingsLoading = computed(() => !buildings.value.length)

const columns = [
  { name: 'code', label: 'Code', field: 'code', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'level', label: 'Level', field: 'level', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
]

const form = {
  fields: [
    { key: 'building_id', label: 'Building', type: 'select', options: buildingOptions, required: true },
    { key: 'code', label: 'Code', type: 'text', required: true, hint: 'e.g. FL-1' },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'level', label: 'Level', type: 'number', required: true },
    { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active', level: 1 },
}

const submit = async (values, editing) => (editing ? floorService.update(editing.id, values) : floorService.create(values))
const destroy = (row) => floorService.remove(row.id)
</script>
