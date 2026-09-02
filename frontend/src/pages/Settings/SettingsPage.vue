<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('admin.settings.title')" :subtitle="t('admin.settings.subtitle')" icon="settings">
      <template #actions>
        <q-btn color="primary" size="sm" icon="save" :label="t('admin.settings.saveChanges')" :loading="saving" :disable="!dirty" @click="save" />
      </template>
    </AppPageHeader>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="120px" class="q-mb-sm" />
      <q-skeleton type="rect" height="120px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <div v-else class="row q-col-gutter-md">
      <!-- Dedicated Language & Localization Card -->
      <div class="col-12 col-md-6">
        <q-card flat bordered class="full-height">
          <q-card-section class="q-pb-none">
            <div class="text-subtitle2 text-weight-bold row items-center">
              <q-icon name="translate" color="primary" size="20px" class="q-mr-sm" />
              {{ t('admin.settings.languageSettings') }}
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-caption text-grey-7 q-mb-md">
              {{ t('admin.settings.selectLanguageHint') }}
            </div>
            <LanguageSwitcher mode="select" :label="t('admin.settings.appLanguage')" />

            <q-separator class="q-my-md" />

            <div class="row q-col-gutter-sm">
              <div v-for="lang in languages" :key="lang.code" class="col-6">
                <q-card
                  flat
                  bordered
                  clickable
                  :class="{ 'bg-primary/10 text-primary text-weight-bold': lang.code === currentLocale }"
                  class="q-pa-sm"
                  @click="setLanguage(lang.code)"
                >
                  <div class="row items-center no-wrap">
                    <span class="text-h6 q-mr-sm">{{ lang.flag }}</span>
                    <div>
                      <div class="text-body2">{{ lang.nativeName }}</div>
                      <div class="text-caption text-grey-6">{{ lang.name }}</div>
                    </div>
                  </div>
                </q-card>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- System Setting Groups from Backend / Mock API -->
      <div v-for="group in groups" :key="group" class="col-12 col-md-6">
        <q-card flat bordered class="full-height">
          <q-card-section class="q-pb-none">
            <div class="text-subtitle2 text-weight-bold text-capitalize">{{ groupLabel(group) }}</div>
          </q-card-section>
          <q-card-section>
            <q-input
              v-for="(value, key) in settings[group] || {}"
              :key="key"
              v-model="draft[group][key]"
              :label="fieldLabel(key)"
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
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import LanguageSwitcher from 'src/components/common/LanguageSwitcher.vue'
import { useLanguage } from 'src/composables/useLanguage'
import { settingsService } from 'src/services/system.service'

const { t, te } = useI18n()
const $q = useQuasar()
const { currentLocale, languages, setLanguage } = useLanguage()

const settings = ref({})
const draft = reactive({})
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const groups = computed(() => Object.keys(settings.value || {}).sort())

function groupLabel(group) {
  if (group === 'university' && te('admin.settings.universitySettings')) return t('admin.settings.universitySettings')
  if (group === 'asset' && te('admin.settings.assetSettings')) return t('admin.settings.assetSettings')
  if (group === 'system' && te('admin.settings.systemDefaults')) return t('admin.settings.systemDefaults')
  return group.replace(/_/g, ' ')
}

function fieldLabel(key) {
  if (te(`common.${key}`)) return t(`common.${key}`)
  return key.replace(/_/g, ' ')
}

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
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (saving.value) return // prevent duplicate submissions
  saving.value = true
  try {
    const payload = {}
    for (const g of groups.value) Object.assign(payload, draft[g])
    await settingsService.update(payload)
    $q.notify({ type: 'positive', icon: 'check_circle', message: t('admin.settings.settingsSaved') })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
