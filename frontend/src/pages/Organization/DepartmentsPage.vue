<template>
  <DataTablePage
    :title="t('organization.departments.title')"
    :subtitle="t('organization.departments.subtitle')"
    icon="account_tree"
    :entity-label="t('organization.departments.entity')"
    :load="departmentService.list"
    :columns="columns"
    perms="organization"
    :search-placeholder="`${t('common.search')}…`"
    :create-label="t('organization.departments.add')"
    :empty-title="t('common.nothingHere')"
    :empty-message="t('common.noDataDesc')"
    :filters="[{ key: 'faculty_id', label: t('common.faculty'), options: facultyOptions, loading: facultiesLoading }]"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { departmentService } from 'src/services/organization.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { t } = useI18n()
const { faculties, opts } = useOptions()
const facultyOptions = computed(() => opts(faculties.value))
const facultiesLoading = computed(() => !faculties.value.length)

const columns = computed(() => [
  { name: 'code', label: t('common.code'), field: 'code', align: 'left' },
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'head', label: t('organization.departments.headName'), field: 'head', align: 'left' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
])

const form = computed(() => ({
  fields: [
    { key: 'faculty_id', label: t('common.faculty'), type: 'select', options: facultyOptions.value, required: true },
    { key: 'code', label: t('common.code'), type: 'text', required: true, hint: 'e.g. DEPT-CS-SW' },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'head', label: t('organization.departments.headName'), type: 'text' },
    { key: 'description', label: t('common.description'), type: 'textarea' },
    { key: 'status', label: t('common.status'), type: 'select', options: [{ label: t('status.active'), value: 'active' }, { label: t('status.inactive'), value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}))

const submit = async (values, editing) => (editing ? departmentService.update(editing.id, values) : departmentService.create(values))
const destroy = (row) => departmentService.remove(row.id)
</script>
