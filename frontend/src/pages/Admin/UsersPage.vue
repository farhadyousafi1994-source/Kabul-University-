<template>
  <DataTablePage
    stats-module="users"
    :title="t('admin.users.title')"
    :subtitle="t('admin.users.subtitle')"
    icon="group"
    :entity-label="t('admin.users.entity')"
    :load="userService.list"
    :columns="columns"
    perms="users"
    :search-placeholder="`${t('common.search')}…`"
    :create-label="t('admin.users.add')"
    :empty-title="t('common.nothingHere')"
    :empty-message="t('common.noDataDesc')"
    :create-form="createForm"
    :edit-form="editForm"
    :submit="submit"
    :destroy="destroy"
    :refresh-key="refreshKey"
  >
    <template #rowActions="{ row }">
      <q-btn v-if="row.status === 'active'" flat dense round size="sm" color="warning" icon="person_off" @click="toggle(row, false)"><q-tooltip>{{ t('status.inactive') }}</q-tooltip></q-btn>
      <q-btn v-else flat dense round size="sm" color="positive" icon="person" @click="toggle(row, true)"><q-tooltip>{{ t('status.active') }}</q-tooltip></q-btn>
    </template>
  </DataTablePage>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { userService, userActions } from 'src/services/users.service'
import { useOptions } from 'src/composables/useOptions'
import DataTablePage from 'src/components/common/DataTablePage.vue'
import { notify } from 'src/utils/notify'
import { confirmAction } from 'src/utils/confirm'

const { t } = useI18n()
const { roles, departments, opts } = useOptions()

/** Bumped after a confirmed write so DataTablePage reloads its rows. */
const refreshKey = ref(0)
const roleOptions = computed(() => opts(roles.value))
const departmentOptions = computed(() => opts(departments.value))

const columns = computed(() => [
  { name: 'name', label: t('admin.users.fullName'), field: 'name', align: 'left' },
  { name: 'username', label: t('admin.users.username'), field: 'username', align: 'left' },
  { name: 'email', label: t('common.email'), field: 'email', align: 'left' },
  { name: 'roles', label: t('admin.users.role'), field: 'id', align: 'left', format: (_, row) => row.roles?.map((r) => r.name).join(', ') || '—' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
])

const roleField = computed(() => ({ key: 'role_ids', label: t('admin.users.role'), type: 'select', options: roleOptions.value, multiple: true, required: true }))

const createForm = computed(() => ({
  fields: [
    { key: 'name', label: t('admin.users.fullName'), type: 'text', required: true },
    { key: 'username', label: t('admin.users.username'), type: 'text', required: true },
    { key: 'email', label: t('common.email'), type: 'text', required: true },
    { key: 'password', label: t('auth.password'), type: 'password', required: true, hint: t('auth.passwordMinLength') },
    { key: 'phone', label: t('common.phone'), type: 'text' },
    { key: 'department_id', label: t('common.department'), type: 'select', options: departmentOptions.value },
    roleField.value,
  ],
  defaults: { role_ids: [] },
}))

const editForm = computed(() => ({
  fields: [
    { key: 'name', label: t('admin.users.fullName'), type: 'text', required: true },
    { key: 'email', label: t('common.email'), type: 'text', required: true },
    { key: 'phone', label: t('common.phone'), type: 'text' },
    { key: 'department_id', label: t('common.department'), type: 'select', options: departmentOptions.value },
    { key: 'password', label: t('auth.newPassword'), type: 'password' },
    roleField.value,
  ],
  defaults: (row) => ({ ...row, role_ids: row.roles?.map((r) => r.id) || [] }),
}))

const submit = async (values, editing) => {
  const payload = { ...values }
  if (!payload.password) delete payload.password
  if (editing) return userService.update(editing.id, payload)
  return userService.create(payload)
}

const destroy = (row) => userService.remove(row.id)

/**
 * Activate / deactivate a login account.
 * The confirmation owns the request lifecycle: the OK button spins, a failure
 * keeps the dialog open, and only a confirmed write refreshes the table.
 */
function toggle(row, activate) {
  const entity = t('common.entities.user')
  return confirmAction({
    title: activate ? t('users.activateTitle') : t('users.deactivateTitle'),
    message: activate
      ? t('users.activateMessage', { name: row.name })
      : t('users.deactivateMessage', { name: row.name }),
    okLabel: activate ? t('status.active') : t('status.inactive'),
    busyLabel: t('common.updating'),
    icon: activate ? 'check_circle' : 'block',
    color: activate ? 'positive' : 'warning',
    errorMessage: t('common.unableToSaveEntity', { entity }),
    onConfirm: () => (activate ? userActions.activate(row.id) : userActions.deactivate(row.id)),
    onConfirmed: () => {
      notify.success(t('common.updatedSuccessEntity', { entity }))
      refreshKey.value += 1
    },
  })
}
</script>
