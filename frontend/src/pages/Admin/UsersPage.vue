<template>
  <DataTablePage
    title="Users"
    subtitle="Accounts and role assignments"
    icon="group"
    entity-label="user"
    :load="userService.list"
    :columns="columns"
    perms="users"
    search-placeholder="Search name, username, email…"
    create-label="Add User"
    empty-title="No users yet"
    empty-message="Users authenticate with their username or email."
    :create-form="createForm"
    :edit-form="editForm"
    :submit="submit"
    :destroy="destroy"
  >
    <template #rowActions="{ row }">
      <q-btn v-if="row.status === 'active'" flat dense round size="sm" color="warning" icon="person_off" @click="toggle(row, false)"><q-tooltip>Deactivate</q-tooltip></q-btn>
      <q-btn v-else flat dense round size="sm" color="positive" icon="person" @click="toggle(row, true)"><q-tooltip>Activate</q-tooltip></q-btn>
    </template>
  </DataTablePage>
</template>

<script setup>
import { computed } from 'vue'
import { userService, userActions } from 'src/services/users.service'
import { useOptions } from 'src/composables/useOptions'
import { useQuasar } from 'quasar'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const $q = useQuasar()
const { roles, departments, opts } = useOptions()
const roleOptions = computed(() => opts(roles.value))
const departmentOptions = computed(() => opts(departments.value))

const columns = [
  { name: 'employee_number', label: 'Emp. No.', field: 'employee_number', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'username', label: 'Username', field: 'username', align: 'left' },
  { name: 'email', label: 'Email', field: 'email', align: 'left' },
  { name: 'roles', label: 'Roles', field: 'id', align: 'left', format: (_, row) => row.roles?.map((r) => r.name).join(', ') || '—' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
]

const roleField = { key: 'role_ids', label: 'Roles', type: 'select', options: roleOptions, multiple: true, required: true }

const createForm = {
  fields: [
    { key: 'name', label: 'Full name', type: 'text', required: true },
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true, hint: 'At least 8 characters' },
    { key: 'employee_number', label: 'Employee number', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'department_id', label: 'Department', type: 'select', options: departmentOptions },
    roleField,
  ],
  defaults: { role_ids: [] },
}

const editForm = {
  fields: [
    { key: 'name', label: 'Full name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'text', required: true },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'employee_number', label: 'Employee number', type: 'text' },
    { key: 'department_id', label: 'Department', type: 'select', options: departmentOptions },
    { key: 'password', label: 'New password (leave blank to keep)', type: 'password' },
    roleField,
  ],
  defaults: (row) => ({ ...row, role_ids: row.roles?.map((r) => r.id) || [] }),
}

const submit = async (values, editing) => {
  const payload = { ...values }
  if (!payload.password) delete payload.password
  if (editing) return userService.update(editing.id, payload)
  return userService.create(payload)
}

const destroy = (row) => userService.remove(row.id)

function toggle(row, activate) {
  $q.dialog({
    title: activate ? 'Activate user' : 'Deactivate user',
    message: `${activate ? 'Activate' : 'Deactivate'} ${row.name}?`,
    cancel: true, persistent: true, color: activate ? 'positive' : 'warning',
  }).onOk(async () => {
    try {
      if (activate) await userActions.activate(row.id)
      else await userActions.deactivate(row.id)
      $q.notify({ type: 'positive', message: activate ? 'User activated.' : 'User deactivated.' })
    } catch (e) {
      $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
    }
  })
}
</script>
