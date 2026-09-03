<template>
  <DataTablePage
    stats-module="faculties"
    :title="t('organization.faculties.title')"
    :subtitle="t('organization.faculties.subtitle')"
    icon="school"
    :entity-label="t('organization.faculties.entity')"
    :load="facultyService.list"
    :columns="columns"
    perms="organization"
    :search-placeholder="`${t('common.search')}…`"
    :create-label="t('organization.faculties.add')"
    :empty-title="t('common.nothingHere')"
    :empty-message="t('common.noDataDesc')"
    :filters="[{ key: 'campus_id', label: t('common.campus'), options: campusOptions, loading: campusesLoading }]"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { facultyService } from 'src/services/organization.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { t } = useI18n()
const { campuses, opts } = useOptions()
const campusOptions = computed(() => opts(campuses.value))
const campusesLoading = computed(() => !campuses.value.length)

const columns = computed(() => [
  { name: 'code', label: t('common.code'), field: 'code', align: 'left' },
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'dean', label: t('organization.faculties.deanName'), field: 'dean', align: 'left' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
])

const form = computed(() => ({
  fields: [
    { key: 'campus_id', label: t('common.campus'), type: 'select', options: campusOptions.value, required: true },
    { key: 'code', label: t('common.code'), type: 'text', required: true, hint: 'e.g. FAC-CS' },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'dean', label: t('organization.faculties.deanName'), type: 'text' },
    { key: 'description', label: t('common.description'), type: 'textarea' },
    { key: 'status', label: t('common.status'), type: 'select', options: [{ label: t('status.active'), value: 'active' }, { label: t('status.inactive'), value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}))

const submit = async (values, editing) => (editing ? facultyService.update(editing.id, values) : facultyService.create(values))
const destroy = (row) => facultyService.remove(row.id)
</script>
