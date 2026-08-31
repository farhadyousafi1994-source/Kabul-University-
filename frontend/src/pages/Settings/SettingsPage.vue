<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader title="System Settings" subtitle="University, asset and system configuration" icon="settings">
      <template #actions>
        <q-btn color="primary" size="sm" icon="save" label="Save changes" :loading="saving" :disable="!dirty" @click="save" />
      </template>
    </AppPageHeader>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="120px" class="q-mb-sm" />
      <q-skeleton type="rect" height="120px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <div v-else class="row q-col-gutter-md">
      <div v-for="group in groups" :key="group" class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section class="q-pb-none">
            <div class="text-subtitle2 text-weight-bold text-capitalize">{{ group }}</div>
          </q-card-section>
          <q-card-section>
            <q-input
              v-for="(value, key) in settings[group] || {}"
              :key="key"
              v-model="draft[group][key]"
              :label="key.replace(/_/g, ' ')"
              dense
              outlined
              class="q-mb-md"
              :type="typeof value === 'number' ? 'number' : 'text'"
            />
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { settingsService } from 'src/services/system.service'

const $q = useQuasar()
const settings = ref({})
const draft = reactive({})
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const groups = computed(() => Object.keys(settings.value || {}).sort())

const dirty = computed(() => {
  for (const g of groups.value) {
    for (const [k, v] of Object.entries(draft[g] || {})) {
      if (String(v) !== String(settings.value[g]?.[k] ?? '')) return true
    }
  }
  return false
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await settingsService.get()
    settings.value = data
    for (const g of Object.keys(data)) {
      if (!draft[g]) draft[g] = reactive({})
      Object.assign(draft[g], { ...data[g] })
    }
  } catch (e) {
    error.value = e.message || 'Failed to load settings.'
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const payload = {}
    for (const g of groups.value) Object.assign(payload, draft[g])
    await settingsService.update(payload)
    $q.notify({ type: 'positive', message: 'Settings saved.' })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || 'Save failed.' })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
