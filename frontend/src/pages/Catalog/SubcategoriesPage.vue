<template>
  <DataTablePage
    :title="t('catalog.subcategories.title')"
    :subtitle="t('catalog.subcategories.subtitle')"
    icon="account_tree"
    :entity-label="t('catalog.subcategories.entity')"
    :load="subcategoryService.list"
    :columns="columns"
    perms="categories"
    :search-placeholder="`${t('common.search')}…`"
    :create-label="t('catalog.subcategories.add')"
    :empty-title="t('common.nothingHere')"
    :empty-message="t('common.noDataDesc')"
    :filters="[{ key: 'category_id', label: t('common.category'), options: categoryOptions, loading: categoriesLoading }]"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { subcategoryService } from 'src/services/catalog.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { t } = useI18n()
const { categories, opts } = useOptions()
const categoryOptions = computed(() => opts(categories.value))
const categoriesLoading = computed(() => !categories.value.length)

const columns = computed(() => [
  { name: 'code', label: t('common.code'), field: 'code', align: 'left' },
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'category_id', label: t('common.category'), field: 'category_id', align: 'left' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
])

const form = computed(() => ({
  fields: [
    { key: 'category_id', label: t('common.category'), type: 'select', options: categoryOptions.value, required: true },
    { key: 'code', label: t('common.code'), type: 'text', required: true, hint: 'e.g. SUB-IT-LAP' },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'description', label: t('common.description'), type: 'textarea' },
    { key: 'status', label: t('common.status'), type: 'select', options: [{ label: t('status.active'), value: 'active' }, { label: t('status.inactive'), value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}))

const submit = async (values, editing) => (editing ? subcategoryService.update(editing.id, values) : subcategoryService.create(values))
const destroy = (row) => subcategoryService.remove(row.id)
</script>
