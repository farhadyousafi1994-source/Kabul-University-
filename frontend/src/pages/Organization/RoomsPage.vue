<template>
  <DataTablePage
    :title="t('organization.rooms.title')"
    :subtitle="t('organization.rooms.subtitle')"
    icon="meeting_room"
    :entity-label="t('organization.rooms.entity')"
    :load="roomService.list"
    :columns="columns"
    perms="organization"
    :search-placeholder="`${t('common.search')}…`"
    :create-label="t('organization.rooms.add')"
    :empty-title="t('common.nothingHere')"
    :empty-message="t('common.noDataDesc')"
    :filters="[{ key: 'floor_id', label: t('common.floor'), options: floorOptions, loading: floorsLoading }]"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { roomService } from 'src/services/organization.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { t } = useI18n()
const { floors, opts } = useOptions()
const floorOptions = computed(() => opts(floors.value))
const floorsLoading = computed(() => !floors.value.length)

const columns = computed(() => [
  { name: 'code', label: t('common.code'), field: 'code', align: 'left' },
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'room_type', label: t('common.type'), field: 'room_type', align: 'left' },
  { name: 'capacity', label: t('organization.rooms.capacity'), field: 'capacity', align: 'left' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
])

const form = computed(() => ({
  fields: [
    { key: 'floor_id', label: t('common.floor'), type: 'select', options: floorOptions.value, required: true },
    { key: 'code', label: t('common.code'), type: 'text', required: true, hint: 'e.g. RM-CS-101' },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'room_type', label: t('organization.rooms.roomType'), type: 'select', options: [
      { label: 'General', value: 'general' }, { label: 'Lecture Hall', value: 'lecture' },
      { label: 'Laboratory', value: 'laboratory' }, { label: 'Office', value: 'office' },
      { label: 'Storage', value: 'storage' }, { label: 'Server Room', value: 'server_room' },
    ], required: true },
    { key: 'capacity', label: t('organization.rooms.capacity'), type: 'number' },
    { key: 'status', label: t('common.status'), type: 'select', options: [{ label: t('status.active'), value: 'active' }, { label: t('status.inactive'), value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active', room_type: 'general' },
}))

const submit = async (values, editing) => (editing ? roomService.update(editing.id, values) : roomService.create(values))
const destroy = (row) => roomService.remove(row.id)
</script>
