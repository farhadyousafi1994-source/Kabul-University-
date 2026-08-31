<template>
  <DataTablePage
    title="Faculties"
    subtitle="University faculties"
    icon="school"
    entity-label="faculty"
    :load="facultyService.list"
    :columns="columns"
    perms="organization"
    search-placeholder="Search by code or name…"
    create-label="Add Faculty"
    empty-title="No faculties yet"
    empty-message="Faculties sit under campuses."
    :filters="[{ key: 'campus_id', label: 'Campus', options: campusOptions, loading: campusesLoading }]"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { facultyService } from 'src/services/organization.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { campuses, opts } = useOptions()
const campusOptions = computed(() => opts(campuses.value))
const campusesLoading = computed(() => !campuses.value.length)

const columns = [
  { name: 'code', label: 'Code', field: 'code', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'dean', label: 'Dean', field: 'dean', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
]

const form = {
  fields: [
    { key: 'campus_id', label: 'Campus', type: 'select', options: campusOptions, required: true },
    { key: 'code', label: 'Code', type: 'text', required: true, hint: 'e.g. FAC-CS' },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'dean', label: 'Dean', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}

const submit = async (values, editing) => (editing ? facultyService.update(editing.id, values) : facultyService.create(values))
const destroy = (row) => facultyService.remove(row.id)
</script>
