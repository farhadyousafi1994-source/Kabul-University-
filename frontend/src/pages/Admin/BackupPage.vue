<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('admin.backup.title')" :subtitle="t('admin.backup.subtitle')" icon="cloud_sync">
      <template #actions>
        <q-btn flat round dense color="primary" icon="refresh" :loading="loading" @click="load">
          <q-tooltip>{{ t('common.refresh') }}</q-tooltip>
        </q-btn>
      </template>
    </AppPageHeader>

    <!-- Loading / error ---------------------------------------------------->
    <div v-if="loading && !backups.length" class="q-mt-sm">
      <q-skeleton type="rect" height="104px" class="q-mb-md rounded-borders" />
      <div class="row q-col-gutter-md">
        <div class="col-12 col-md-6"><q-skeleton type="rect" height="220px" class="rounded-borders" /></div>
        <div class="col-12 col-md-6"><q-skeleton type="rect" height="220px" class="rounded-borders" /></div>
      </div>
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <template v-else>
      <!-- Hero ------------------------------------------------------------->
      <div class="bk-hero">
        <div class="bk-hero__glow" />
        <div class="bk-hero__shield">
          <q-icon name="verified_user" size="30px" />
        </div>
        <div class="bk-hero__body">
          <div class="bk-hero__title">{{ t('admin.backup.heroTitle') }}</div>
          <div class="bk-hero__sub">
            <template v-if="meta.last_backup">
              {{ t('admin.backup.lastBackup') }} · {{ date(meta.last_backup.created_at, true) }} ·
              {{ fileSize(meta.last_backup.size) }}
            </template>
            <template v-else>{{ t('admin.backup.never') }}</template>
          </div>
        </div>
        <div class="q-space" />
        <div class="bk-hero__count">
          <div class="bk-hero__n">{{ backups.length }}</div>
          <div class="bk-hero__l">{{ t('admin.backup.versions') }}</div>
        </div>
      </div>

      <!-- Take / restore --------------------------------------------------->
      <div class="row q-col-gutter-md q-mt-md">
        <div class="col-12 col-md-6">
          <div class="bk-card bk-card--take">
            <div class="bk-card__ico"><q-icon name="cloud_download" size="26px" /></div>
            <div class="bk-card__title">{{ t('admin.backup.takeTitle') }}</div>
            <div class="bk-card__text">{{ t('admin.backup.takeText') }}</div>
            <q-btn-toggle
              v-model="format"
              dense
              no-caps
              spread
              class="bk-card__fmt"
              :options="[
                { label: t('admin.backup.formatSqlite'), value: 'sqlite' },
                { label: t('admin.backup.formatJson'), value: 'json' },
              ]"
            />
            <div class="bk-card__note">
              {{ format === 'json' ? t('admin.backup.formatJsonNote') : t('admin.backup.formatSqliteNote') }}
            </div>
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="download"
              :label="t('admin.backup.takeButton')"
              :loading="taking"
              class="bk-card__go"
              @click="takeBackup"
            />
          </div>
        </div>

        <div class="col-12 col-md-6">
          <div class="bk-card bk-card--put">
            <div class="bk-card__ico"><q-icon name="restore" size="26px" /></div>
            <div class="bk-card__title">{{ t('admin.backup.restoreTitle') }}</div>
            <div class="bk-card__text">{{ t('admin.backup.restoreText') }}</div>
            <q-file
              v-model="file"
              dense
              outlined
              accept=".json"
              :label="t('admin.backup.fileLabel')"
              class="bk-card__file"
              :error="Boolean(fileError)"
              :error-message="fileError"
              clearable
              @clear="clearFile"
            >
              <template #prepend>
                <q-icon name="attach_file" />
              </template>
            </q-file>
            <q-btn
              unelevated
              no-caps
              color="negative"
              icon="restore"
              :label="t('admin.backup.restoreButton')"
              :disable="!snapshot"
              :loading="restoring"
              class="bk-card__go bk-card__go--warn"
              @click="confirmRestore = true"
            />
          </div>
        </div>
      </div>

      <!-- Clean start ------------------------------------------------------>
      <div class="bk-fresh q-mt-md">
        <q-icon name="auto_delete" size="22px" class="bk-fresh__ico" />
        <div class="bk-fresh__body">
          <div class="bk-fresh__title">{{ t('admin.backup.freshTitle') }}</div>
          <div class="bk-fresh__text">{{ t('admin.backup.freshText') }}</div>
        </div>
        <div class="q-space" />
        <q-btn
          outline
          dense
          no-caps
          color="blue-grey-8"
          icon="file_download"
          :label="t('admin.backup.freshButton')"
          :loading="freshing"
          @click="downloadFreshTemplate"
        />
      </div>

      <!-- History ---------------------------------------------------------->
      <div class="bk-list q-mt-md">
        <div class="bk-list__head">
          <q-icon name="history" size="18px" />
          <span>{{ t('admin.backup.historyTitle') }}</span>
          <q-chip dense color="teal-1" text-color="teal-9" class="bk-list__chip">
            {{ backups.length }} · {{ fileSize(meta.total_size) }}
          </q-chip>
          <div class="q-space" />
          <q-btn flat round dense color="grey-7" icon="refresh" :loading="loading" @click="load" />
        </div>

        <EmptyState
          v-if="!backups.length"
          icon="backup"
          :title="t('admin.backup.noBackups')"
          :message="t('admin.backup.noBackupsDesc')"
        />

        <div v-else class="bk-rows">
          <div v-for="row in backups" :key="row.id" class="bk-row">
            <q-icon name="description" size="19px" class="text-teal-7" />
            <div class="bk-row__body">
              <div class="bk-row__name">{{ row.filename }}</div>
              <div class="bk-row__meta">
                {{ date(row.created_at, true) }} · {{ fileSize(row.size) }}
                <span v-if="row.kind === 'pre_restore'" class="bk-row__tag">
                  {{ t('admin.backup.autoSafety') }}
                </span>
              </div>
            </div>
            <q-btn flat round dense color="primary" icon="download" @click="download(row)">
              <q-tooltip>{{ t('common.download') }}</q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              dense
              color="negative"
              icon="delete"
              :loading="deletingId === row.id"
              @click="pendingDelete = row"
            >
              <q-tooltip>{{ t('common.delete') }}</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>
    </template>

    <!-- Restore confirmation ----------------------------------------------->
    <q-dialog v-model="confirmRestore" persistent>
      <q-card style="min-width: 340px; max-width: 460px">
        <q-card-section class="row items-center no-wrap bk-dialog__head">
          <q-avatar icon="restore" color="negative" text-color="white" size="40px" />
          <div class="text-h6">{{ t('admin.backup.confirmRestoreTitle') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <div>{{ t('admin.backup.confirmRestore', { name: fileName }) }}</div>
          <div class="bk-note q-mt-sm">
            <q-icon name="info" size="16px" />
            {{ t('admin.backup.restoreWarning') }}
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" @click="confirmRestore = false" />
          <q-btn unelevated no-caps color="negative" icon="restore" :label="t('admin.backup.restoreButton')"
            :loading="restoring" @click="doRestore" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete confirmation ------------------------------------------------>
    <q-dialog v-model="deleteOpen" persistent>
      <q-card style="min-width: 340px; max-width: 460px">
        <q-card-section class="row items-center no-wrap bk-dialog__head">
          <q-avatar icon="delete" color="negative" text-color="white" size="40px" />
          <div class="text-h6">{{ t('admin.backup.confirmDeleteTitle') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          {{ t('admin.backup.confirmDelete', { name: pendingDelete?.filename || '' }) }}
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" @click="pendingDelete = null" />
          <q-btn unelevated no-caps color="negative" icon="delete" :label="t('common.delete')"
            :loading="deletingId === pendingDelete?.id" @click="doDelete" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { backupService } from 'src/services/backup.service'
import { date, fileSize } from 'src/utils/format'

const { t } = useI18n()
const $q = useQuasar()

const backups = ref([])
const meta = ref({ count: 0, total_size: 0, last_backup: null })
const loading = ref(false)
const error = ref('')

const taking = ref(false)
const restoring = ref(false)
const freshing = ref(false)
const deletingId = ref(null)

const format = ref('sqlite')
const file = ref(null)
const snapshot = ref(null)
const fileError = ref('')
const confirmRestore = ref(false)
const pendingDelete = ref(null)

const deleteOpen = computed({
  get: () => Boolean(pendingDelete.value),
  set: (value) => {
    if (!value) pendingDelete.value = null
  },
})

const fileName = computed(() => file.value?.name || '')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data, meta: responseMeta } = await backupService.list()
    backups.value = data || []
    meta.value = responseMeta || { count: backups.value.length, total_size: 0, last_backup: null }
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

async function takeBackup() {
  taking.value = true
  try {
    const { data } = await backupService.create({ format: format.value })
    await backupService.downloadFile(
      backupService.downloadUrl(data.id),
      data.filename || `ku-ams-backup.${format.value === 'json' ? 'json' : 'sqlite'}`,
    )
    $q.notify({ type: 'positive', message: t('admin.backup.takenSuccess') })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.error') })
  } finally {
    taking.value = false
  }
}

async function download(row) {
  try {
    await backupService.downloadFile(backupService.downloadUrl(row.id), row.filename || 'ku-ams-backup')
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.error') })
  }
}

async function downloadFreshTemplate() {
  freshing.value = true
  try {
    const stamp = new Date().toISOString().slice(0, 10)
    await backupService.downloadFile(backupService.freshTemplateUrl, `ku-ams-fresh-start-${stamp}.json`)
    $q.notify({ type: 'positive', message: t('admin.backup.freshTemplateDownloaded') })
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.error') })
  } finally {
    freshing.value = false
  }
}

async function doRestore() {
  if (!snapshot.value) {
    $q.notify({ type: 'warning', message: t('admin.backup.pickFileFirst') })
    return
  }

  restoring.value = true
  try {
    await backupService.restore(snapshot.value)
    $q.notify({ type: 'positive', message: t('admin.backup.restoredSuccess') })
    confirmRestore.value = false
    clearFile()
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.error') })
  } finally {
    restoring.value = false
  }
}

async function doDelete() {
  const row = pendingDelete.value
  if (!row) return

  deletingId.value = row.id
  try {
    await backupService.remove(row.id)
    $q.notify({ type: 'positive', message: t('admin.backup.deletedSuccess') })
    pendingDelete.value = null
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.error') })
  } finally {
    deletingId.value = null
  }
}

function clearFile() {
  file.value = null
  snapshot.value = null
  fileError.value = ''
}

// Parse the picked file as soon as it is selected so the restore button can
// stay disabled until a valid snapshot is loaded.
watch(file, async (value) => {
  snapshot.value = null
  fileError.value = ''
  if (!value) return

  try {
    snapshot.value = await backupService.readSnapshot(value)
  } catch (e) {
    fileError.value = e.message === 'read-failed' ? t('admin.backup.readFailed') : t('admin.backup.invalidFile')
  }
})

onMounted(load)
</script>

<style lang="sass">
// ---------------------------------------------------------------------------
// Backup & restore (Module 29) — hero, action cards and history list.
// ---------------------------------------------------------------------------

.bk-hero
  position: relative
  overflow: hidden
  display: flex
  align-items: center
  gap: 14px
  padding: 18px
  border-radius: 14px
  color: #fff
  background: linear-gradient(120deg, $primary 0%, #00695c 100%)
  box-shadow: 0 6px 18px rgba(0, 0, 0, .10)

  &__glow
    position: absolute
    inset: auto -40px -70px auto
    width: 190px
    height: 190px
    border-radius: 50%
    background: rgba(255, 255, 255, .12)
    pointer-events: none

  &__shield
    flex-shrink: 0
    width: 52px
    height: 52px
    border-radius: 50%
    display: flex
    align-items: center
    justify-content: center
    background: rgba(255, 255, 255, .18)
    border: 1px solid rgba(255, 255, 255, .35)

  &__body
    min-width: 0
    z-index: 1

  &__title
    font-size: 17px
    font-weight: 700
    line-height: 1.3

  &__sub
    font-size: 12px
    opacity: .85
    margin-top: 2px

  &__count
    flex-shrink: 0
    z-index: 1
    text-align: center
    padding: 6px 16px
    border-radius: 12px
    background: rgba(255, 255, 255, .16)
    border: 1px solid rgba(255, 255, 255, .28)

  &__n
    font-size: 24px
    font-weight: 700
    line-height: 1.1

  &__l
    font-size: 11px
    opacity: .85

.bk-card
  display: flex
  flex-direction: column
  align-items: flex-start
  height: 100%
  padding: 18px
  border-radius: 14px
  border: 1px solid rgba(0, 0, 0, .08)
  background: #fff

  &__ico
    width: 46px
    height: 46px
    border-radius: 12px
    display: flex
    align-items: center
    justify-content: center
    color: $primary
    background: rgba(27, 94, 32, .10)
    margin-bottom: 12px

  &__title
    font-size: 15px
    font-weight: 700

  &__text
    font-size: 12px
    color: #757575
    line-height: 1.6
    margin-bottom: 14px

  &__file
    width: 100%
    margin-bottom: 12px

  &__fmt
    width: 100%
    margin-bottom: 8px
    border-radius: 10px
    overflow: hidden

    .q-btn
      font-size: 12px

  &__note
    font-size: 11px
    color: #9e9e9e
    line-height: 1.5
    margin-bottom: 12px

  &__go
    width: 100%
    margin-top: auto

  &--put &__ico
    color: #e65100
    background: rgba(245, 124, 0, .12)

.bk-fresh
  display: flex
  align-items: center
  gap: 14px
  padding: 14px 16px
  border-radius: 14px
  border: 1px dashed rgba(0, 0, 0, .16)
  background: rgba(0, 0, 0, .02)

  &__ico
    color: #00695c
    flex-shrink: 0

  &__body
    min-width: 0

  &__title
    font-size: 14px
    font-weight: 700

  &__text
    font-size: 12px
    color: #757575
    line-height: 1.6

.bk-list
  border-radius: 14px
  border: 1px solid rgba(0, 0, 0, .08)
  background: #fff
  overflow: hidden

  &__head
    display: flex
    align-items: center
    gap: 8px
    padding: 12px 14px
    font-size: 14px
    font-weight: 600
    border-bottom: 1px solid rgba(0, 0, 0, .06)

  &__chip
    font-size: 10px

.bk-rows
  max-height: 460px
  overflow-y: auto

.bk-row
  display: flex
  align-items: center
  gap: 10px
  padding: 10px 14px
  border-bottom: 1px solid rgba(0, 0, 0, .05)

  &:last-child
    border-bottom: none

  &:hover
    background: rgba(0, 0, 0, .02)

  &__body
    flex: 1
    min-width: 0

  &__name
    font-size: 13px
    font-weight: 500
    word-break: break-all
    line-height: 1.35

  &__meta
    font-size: 11px
    color: #9e9e9e
    margin-top: 2px

  &__tag
    display: inline-block
    margin-inline-start: 6px
    padding: 0 6px
    border-radius: 8px
    background: rgba(245, 124, 0, .12)
    color: #e65100

.bk-dialog__head
  gap: 12px

.bk-note
  display: flex
  align-items: flex-start
  gap: 6px
  font-size: 12px
  padding: 8px 10px
  border-radius: 8px
  background: rgba(2, 119, 189, .08)
  color: #01579b

.body--dark
  .bk-card,
  .bk-list
    background: $dark-page
    border-color: rgba(255, 255, 255, .12)

  .bk-card__text,
  .bk-fresh__text
    color: #b0b0b0

  .bk-row__meta
    color: #8a8a8a

  .bk-row:hover
    background: rgba(255, 255, 255, .04)

  .bk-fresh
    background: rgba(255, 255, 255, .03)
    border-color: rgba(255, 255, 255, .16)

@media (max-width: 599px)
  .bk-hero
    flex-wrap: wrap
    padding: 14px

    &__count
      padding: 4px 12px

  .bk-fresh
    flex-wrap: wrap
</style>
