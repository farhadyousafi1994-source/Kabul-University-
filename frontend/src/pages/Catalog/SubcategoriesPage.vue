<template>
  <DataTablePage
    title="Subcategories"
    subtitle="Detailed classification inside categories"
    icon="account_tree"
    entity-label="subcategory"
    :load="subcategoryService.list"
    :columns="columns"
    perms="categories"
    search-placeholder="Search by code or name…"
    create-label="Add Subcategory"
    empty-title="No subcategories yet"
    empty-message="Subcategories refine a category (e.g. Laptops under IT Equipment)."
    :filters="[{ key: 'category_id', label: 'Category', options: categoryOptions, loading: categoriesLoading }]"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { subcategoryService } from 'src/services/catalog.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { categories, opts } = useOptions()
const categoryOptions = computed(() => opts(categories.value))
const categoriesLoading = computed(() => !categories.value.length)

const columns = [
  { name: 'code', label: 'Code', field: 'code', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'category_id', label: 'Category', field: 'category_id', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
]

const form = {
  fields: [
    { key: 'category_id', label: 'Category', type: 'select', options: categoryOptions, required: true },
    { key: 'code', label: 'Code', type: 'text', required: true, hint: 'e.g. SUB-IT-LAP' },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}

const submit = async (values, editing) => (editing ? subcategoryService.update(editing.id, values) : subcategoryService.create(values))
const destroy = (row) => subcategoryService.remove(row.id)
</script>
