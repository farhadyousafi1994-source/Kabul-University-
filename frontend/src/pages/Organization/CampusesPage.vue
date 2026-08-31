<template>
  <DataTablePage
    title="Campuses"
    subtitle="Kabul University campuses"
    icon="location_city"
    entity-label="campus"
    :load="campusService.list"
    :columns="columns"
    perms="organization"
    search-placeholder="Search by code or name…"
    create-label="Add Campus"
    empty-title="No campuses yet"
    empty-message="Add your first campus to start structuring the university."
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { campusService } from 'src/services/organization.service'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const columns = [
  { name: 'code', label: 'Code', field: 'code', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'address', label: 'Address', field: 'address', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
]

const form = {
  fields: [
    { key: 'code', label: 'Code', type: 'text', required: true, hint: 'e.g. CAMP-MAIN' },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'address', label: 'Address', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}

const submit = async (values, editing) => (editing ? campusService.update(editing.id, values) : campusService.create(values))
const destroy = (row) => campusService.remove(row.id)
</script>
