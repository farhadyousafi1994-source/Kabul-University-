<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('admin.roles.title')" :subtitle="t('admin.roles.subtitle')" icon="admin_panel_settings" />

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="columns"
      :filename="'Roles_Report'"
      :title="t('nav.items.roles')"
    />

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else>
      <div class="print-area">
      <div class="print-title text-h6 q-mb-xs">{{ t('admin.roles.title') }}</div>
      <q-table :rows="rows" :columns="columns" row-key="id" flat dense hide-bottom wrap-cells :pagination="{ rowsPerPage: 20 }" class="q-mt-sm data-table">
        <template v-slot:body-cell-permissions="props">
          <q-td :props="props" class="text-caption">
            <q-chip v-for="p in props.row.permissions?.slice(0, 6)" :key="p.id" size="xs" dense color="primary" text-color="white" class="q-ma-none q-mr-xs">{{ p.name }}</q-chip>
            <span v-if="(props.row.permissions?.length || 0) > 6" class="text-grey-6">+{{ props.row.permissions.length - 6 }} more</span>
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn v-if="canUpdate" flat dense round size="sm" color="primary" icon="edit" @click="openEdit(props.row)"><q-tooltip>{{ t('common.edit') }}</q-tooltip></q-btn>
            <q-btn v-if="canDelete" flat dense round size="sm" color="negative" icon="delete_outline" @click="remove(props.row)"><q-tooltip>{{ t('common.delete') }}</q-tooltip></q-btn>
          </q-td>
        </template>
      </q-table>
      </div>
    </template>

    <q-dialog v-model="dialogOpen" persistent :maximized="$q.screen.lt.md">
      <q-card style="min-width: 520px; max-width: 860px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ editing ? t('admin.roles.editRole', { name: editing.name }) : t('admin.roles.add') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" :disable="saving" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="form.name"
            :label="`${t('admin.roles.roleName')} *`"
            dense
            outlined
            class="q-mb-md"
            :rules="[(v) => !!v || t('common.required')]"
            :disable="saving"
            :error="Boolean(fieldErrors.name)"
            :error-message="fieldErrors.name"
            data-cy="role-name"
          />
          <div class="text-subtitle2 q-mb-sm">{{ t('admin.roles.permissions') }}</div>
          <div class="row q-col-gutter-sm">
            <div v-for="group in permissionGroups" :key="group" class="col-12 col-md-6">
              <div class="text-overline text-grey-6">{{ group }}</div>
              <q-checkbox
                v-for="p in permissionsByGroup(group)"
                :key="p.id"
                v-model="form.permission_ids"
                :val="p.id"
                :label="p.name"
                dense
                size="sm"
              />
            </div>
          </div>
        </q-card-section>
        <q-card-section class="row justify-end q-gutter-sm q-pt-none">
          <q-btn :label="t('common.cancel')" flat color="grey-7" :disable="saving" @click="dialogOpen = false" />
          <q-btn
            :label="saving ? t('common.saving') : t('common.save')"
            color="primary"
            :loading="saving"
            data-cy="role-save"
            @click="save"
          >
            <template #loading><q-spinner-dots class="q-mr-sm" />{{ t('common.saving') }}</template>
          </q-btn>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import TableActionBar from 'src/components/common/TableActionBar.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { roleService, roleActions } from 'src/services/users.service'
import { useAuthStore } from 'src/stores/auth'
import { notify } from 'src/utils/notify'
import { useAction } from 'src/composables/useAction'
import { confirmDelete } from 'src/utils/confirm'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()

const barActions = computed(() => [
  { key: 'add', icon: 'add', label: t('admin.roles.add'), color: 'primary', show: canCreate.value, handler: () => openEdit(null) },
])

const rows = ref([])
const allPermissions = ref([])
const loading = ref(false)
const error = ref('')
/**
 * Shared action lifecycle: loading flag, duplicate-submission guard, specific
 * success toast, and server validation mapped onto `fieldErrors`.
 */
const saveAction = useAction()
const saving = saveAction.pending
const fieldErrors = saveAction.fieldErrors
const dialogOpen = ref(false)
const editing = ref(null)
const form = reactive({ name: '', permission_ids: [] })

const canCreate = computed(() => authStore.hasPermission('roles.create'))
const canUpdate = computed(() => authStore.hasPermission('roles.update'))
const canDelete = computed(() => authStore.hasPermission('roles.delete'))

const columns = computed(() => [
  { name: 'name', label: t('admin.roles.roleName'), field: 'name', align: 'left' },
  { name: 'users_count', label: t('admin.roles.usersCount'), field: 'users_count', align: 'right' },
  { name: 'permissions', label: t('admin.roles.permissions'), field: 'id', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
])

const permissionGroups = computed(() => {
  const groups = new Set()
  for (const p of allPermissions.value) groups.add(p.name.split('.')[0])
  return [...groups].sort()
})

function permissionsByGroup(group) {
  return allPermissions.value.filter((p) => p.name.startsWith(group + '.'))
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [rolesRes, permsRes] = await Promise.all([roleService.list(), roleActions.permissions()])
    rows.value = rolesRes.data?.data || []
    allPermissions.value = permsRes.data?.data || []
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

function openEdit(role) {
  editing.value = role
  form.name = role?.name || ''
  form.permission_ids = role ? (role.permissions || []).map((p) => p.id) : []
  dialogOpen.value = true
}

function save() {
  const wasEditing = Boolean(editing.value)
  const id = editing.value?.id
  const entity = t('common.entities.role')
  const payload = { name: form.name, permission_ids: form.permission_ids }

  return saveAction.run(
    () => (wasEditing ? roleService.update(id, payload) : roleService.create(payload)),
    {
      successMessage: wasEditing
        ? t('common.updatedSuccessEntity', { entity })
        : t('common.createdSuccessEntity', { entity }),
      errorMessage: t('common.unableToSaveEntity', { entity }),
      onSuccess: async () => {
        dialogOpen.value = false
        editing.value = null
        saveAction.clearFieldErrors()
        await load()
      },
    },
  )
}

function remove(role) {
  return confirmDelete({
    entity: t('common.entities.role'),
    name: role.name,
    onConfirm: () => roleService.remove(role.id),
    onConfirmed: async () => {
      notify.success(t('common.deletedSuccessEntity', { entity: t('common.entities.role') }))
      await load()
    },
  })
}

onMounted(load)
</script>
