<template>
  <DataTablePage
    title="Asset Categories"
    subtitle="Top-level classification of assets"
    icon="category"
    entity-label="category"
    :load="categoryService.list"
    :columns="columns"
    perms="categories"
    search-placeholder="Search by code or name…"
    create-label="Add Category"
    empty-title="No categories yet"
    empty-message="Categories group assets (e.g. IT Equipment, Furniture)."
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { categoryService } from 'src/services/catalog.service'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const columns = [
  { name: 'code', label: 'Code', field: 'code', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'description', label: 'Description', field: 'description', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
]

const form = {
  fields: [
    { key: 'code', label: 'Code', type: 'text', required: true, hint: 'e.g. CAT-IT' },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}

const submit = async (values, editing) => (editing ? categoryService.update(editing.id, values) : categoryService.create(values))
const destroy = (row) => categoryService.remove(row.id)
</script>
