<template>
  <DataTablePage
    stats-module="categories"
    :title="t('catalog.categories.title')"
    :subtitle="t('catalog.categories.subtitle')"
    icon="category"
    :entity-label="t('catalog.categories.entity')"
    :load="categoryService.list"
    :columns="columns"
    perms="categories"
    :search-placeholder="`${t('common.search')}…`"
    :create-label="t('catalog.categories.add')"
    :empty-title="t('common.nothingHere')"
    :empty-message="t('common.noDataDesc')"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { categoryService } from 'src/services/catalog.service'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { t } = useI18n()

const columns = computed(() => [
  { name: 'code', label: t('common.code'), field: 'code', align: 'left' },
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'description', label: t('common.description'), field: 'description', align: 'left' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
])

const form = computed(() => ({
  fields: [
    { key: 'code', label: t('common.code'), type: 'text', required: true, hint: 'e.g. CAT-IT' },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'description', label: t('common.description'), type: 'textarea' },
    { key: 'status', label: t('common.status'), type: 'select', options: [{ label: t('status.active'), value: 'active' }, { label: t('status.inactive'), value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}))

const submit = async (values, editing) => (editing ? categoryService.update(editing.id, values) : categoryService.create(values))
const destroy = (row) => categoryService.remove(row.id)
</script>
