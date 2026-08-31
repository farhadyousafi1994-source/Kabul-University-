<template>
  <DataTablePage
    title="Buildings"
    subtitle="Buildings across campuses"
    icon="apartment"
    entity-label="building"
    :load="buildingService.list"
    :columns="columns"
    perms="organization"
    search-placeholder="Search by code or name…"
    create-label="Add Building"
    empty-title="No buildings yet"
    empty-message="Buildings sit under campuses."
    :filters="[{ key: 'campus_id', label: 'Campus', options: campusOptions, loading: campusesLoading }]"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { buildingService } from 'src/services/organization.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { campuses, opts } = useOptions()
const campusOptions = computed(() => opts(campuses.value))
const campusesLoading = computed(() => !campuses.value.length)

const columns = [
  { name: 'code', label: 'Code', field: 'code', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'description', label: 'Description', field: 'description', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
]

const form = {
  fields: [
    { key: 'campus_id', label: 'Campus', type: 'select', options: campusOptions, required: true },
    { key: 'code', label: 'Code', type: 'text', required: true, hint: 'e.g. BLD-CS' },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}

const submit = async (values, editing) => (editing ? buildingService.update(editing.id, values) : buildingService.create(values))
const destroy = (row) => buildingService.remove(row.id)
</script>
