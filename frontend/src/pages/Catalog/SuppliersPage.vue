<template>
  <DataTablePage
    title="Suppliers"
    subtitle="Vendors used for asset procurement"
    icon="local_shipping"
    entity-label="supplier"
    :load="supplierService.list"
    :columns="columns"
    perms="suppliers"
    search-placeholder="Search by name, company or email…"
    create-label="Add Supplier"
    empty-title="No suppliers yet"
    empty-message="Add suppliers before creating purchase requests."
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { supplierService } from 'src/services/catalog.service'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const columns = [
  { name: 'code', label: 'Code', field: 'code', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'company_name', label: 'Company', field: 'company_name', align: 'left' },
  { name: 'contact_person', label: 'Contact', field: 'contact_person', align: 'left' },
  { name: 'phone', label: 'Phone', field: 'phone', align: 'left' },
  { name: 'email', label: 'Email', field: 'email', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
]

const form = {
  fields: [
    { key: 'code', label: 'Code', type: 'text', required: true, hint: 'e.g. SUP-001' },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'company_name', label: 'Company name', type: 'text' },
    { key: 'contact_person', label: 'Contact person', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'address', label: 'Address', type: 'textarea' },
    { key: 'tax_number', label: 'Tax number', type: 'text' },
    { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}

const submit = async (values, editing) => (editing ? supplierService.update(editing.id, values) : supplierService.create(values))
const destroy = (row) => supplierService.remove(row.id)
</script>
