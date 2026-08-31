<template>
  <DataTablePage
    title="Departments"
    subtitle="University departments"
    icon="account_tree"
    entity-label="department"
    :load="departmentService.list"
    :columns="columns"
    perms="organization"
    search-placeholder="Search by code or name…"
    create-label="Add Department"
    empty-title="No departments yet"
    empty-message="Departments sit under faculties."
    :filters="[{ key: 'faculty_id', label: 'Faculty', options: facultyOptions, loading: facultiesLoading }]"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { departmentService } from 'src/services/organization.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { faculties, opts } = useOptions()
const facultyOptions = computed(() => opts(faculties.value))
const facultiesLoading = computed(() => !faculties.value.length)

const columns = [
  { name: 'code', label: 'Code', field: 'code', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'head', label: 'Head', field: 'head', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
]

const form = {
  fields: [
    { key: 'faculty_id', label: 'Faculty', type: 'select', options: facultyOptions, required: true },
    { key: 'code', label: 'Code', type: 'text', required: true, hint: 'e.g. DEPT-CS-SW' },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'head', label: 'Head', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}

const submit = async (values, editing) => (editing ? departmentService.update(editing.id, values) : departmentService.create(values))
const destroy = (row) => departmentService.remove(row.id)
</script>
