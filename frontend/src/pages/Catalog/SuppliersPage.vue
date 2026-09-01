<template>
  <DataTablePage
    :title="t('catalog.suppliers.title')"
    :subtitle="t('catalog.suppliers.subtitle')"
    icon="local_shipping"
    :entity-label="t('catalog.suppliers.entity')"
    :load="supplierService.list"
    :columns="columns"
    perms="suppliers"
    :search-placeholder="`${t('common.search')}…`"
    :create-label="t('catalog.suppliers.add')"
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
import { supplierService } from 'src/services/catalog.service'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { t } = useI18n()

const columns = computed(() => [
  { name: 'code', label: t('common.code'), field: 'code', align: 'left' },
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'company_name', label: t('catalog.suppliers.entity'), field: 'company_name', align: 'left' },
  { name: 'contact_person', label: t('catalog.suppliers.contactPerson'), field: 'contact_person', align: 'left' },
  { name: 'phone', label: t('common.phone'), field: 'phone', align: 'left' },
  { name: 'email', label: t('common.email'), field: 'email', align: 'left' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
])

const form = computed(() => ({
  fields: [
    { key: 'code', label: t('common.code'), type: 'text', required: true, hint: 'e.g. SUP-001' },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'company_name', label: t('common.name'), type: 'text' },
    { key: 'contact_person', label: t('catalog.suppliers.contactPerson'), type: 'text' },
    { key: 'phone', label: t('common.phone'), type: 'text' },
    { key: 'email', label: t('common.email'), type: 'text' },
    { key: 'address', label: t('common.address'), type: 'textarea' },
    { key: 'tax_number', label: t('catalog.suppliers.taxNumber'), type: 'text' },
    { key: 'status', label: t('common.status'), type: 'select', options: [{ label: t('status.active'), value: 'active' }, { label: t('status.inactive'), value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}))

const submit = async (values, editing) => (editing ? supplierService.update(editing.id, values) : supplierService.create(values))
const destroy = (row) => supplierService.remove(row.id)
</script>
