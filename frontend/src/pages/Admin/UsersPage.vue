<template>
  <DataTablePage
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
  >
    <template #rowActions="{ row }">
      <q-btn v-if="row.status === 'active'" flat dense round size="sm" color="warning" icon="person_off" @click="toggle(row, false)"><q-tooltip>{{ t('status.inactive') }}</q-tooltip></q-btn>
      <q-btn v-else flat dense round size="sm" color="positive" icon="person" @click="toggle(row, true)"><q-tooltip>{{ t('status.active') }}</q-tooltip></q-btn>
    </template>
  </DataTablePage>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { userService, userActions } from 'src/services/users.service'
import { useOptions } from 'src/composables/useOptions'
import { useQuasar } from 'quasar'
import DataTablePage from 'src/components/common/DataTablePage.vue'

const { t } = useI18n()
const $q = useQuasar()
const { roles, departments, opts } = useOptions()
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

function toggle(row, activate) {
  $q.dialog({
    title: activate ? t('status.active') : t('status.inactive'),
    message: `${activate ? t('status.active') : t('status.inactive')} ${row.name}?`,
    cancel: true, persistent: true, color: activate ? 'positive' : 'warning',
  }).onOk(async () => {
    try {
      if (activate) await userActions.activate(row.id)
      else await userActions.deactivate(row.id)
      $q.notify({ type: 'positive', icon: 'check_circle', message: t('common.updatedSuccessEntity', { entity: t('common.entities.user') }) })
    } catch (e) {
      $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
    }
  })
}
</script>
