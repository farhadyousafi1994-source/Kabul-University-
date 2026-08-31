<template>
  <DataTablePage
    title="Rooms"
    subtitle="Rooms within floors"
    icon="meeting_room"
    entity-label="room"
    :load="roomService.list"
    :columns="columns"
    perms="organization"
    search-placeholder="Search by code or name…"
    create-label="Add Room"
    empty-title="No rooms yet"
    empty-message="Rooms sit under floors."
    :filters="[{ key: 'floor_id', label: 'Floor', options: floorOptions, loading: floorsLoading }]"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  />
</template>

<script setup>
import { computed } from 'vue'
import { roomService } from 'src/services/organization.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { floors, opts } = useOptions()
const floorOptions = computed(() => opts(floors.value))
const floorsLoading = computed(() => !floors.value.length)

const columns = [
  { name: 'code', label: 'Code', field: 'code', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'room_type', label: 'Type', field: 'room_type', align: 'left' },
  { name: 'capacity', label: 'Capacity', field: 'capacity', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
]

const form = {
  fields: [
    { key: 'floor_id', label: 'Floor', type: 'select', options: floorOptions, required: true },
    { key: 'code', label: 'Code', type: 'text', required: true, hint: 'e.g. RM-CS-101' },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'room_type', label: 'Room type', type: 'select', options: [
      { label: 'General', value: 'general' }, { label: 'Lecture Hall', value: 'lecture' },
      { label: 'Laboratory', value: 'laboratory' }, { label: 'Office', value: 'office' },
      { label: 'Storage', value: 'storage' }, { label: 'Server Room', value: 'server_room' },
    ], required: true },
    { key: 'capacity', label: 'Capacity', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active', room_type: 'general' },
}

const submit = async (values, editing) => (editing ? roomService.update(editing.id, values) : roomService.create(values))
const destroy = (row) => roomService.remove(row.id)
</script>
