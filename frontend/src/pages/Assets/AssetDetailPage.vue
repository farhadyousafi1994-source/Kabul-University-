<template>
  <div class="page-container q-pa-md q-pa-lg-md" v-if="asset">
    <!-- Header -->
    <div class="row items-center q-mb-md no-wrap">
      <q-btn flat round dense icon="arrow_back" aria-label="Back" :to="{ name: 'assets' }" class="q-mr-sm" />
      <q-icon name="inventory_2" size="30px" color="primary" class="q-mr-sm" />
      <div class="col">
        <div class="text-h6 text-weight-bold q-mb-none">{{ asset.name }}</div>
        <div class="text-caption text-grey-6">{{ asset.asset_code }} · <StatusBadge :value="asset.status" /></div>
      </div>
      <q-space />
      <div class="row q-gutter-xs no-wrap">
        <q-btn v-if="canAssign && ['available', 'reserved'].includes(asset.status)" color="info" size="sm" icon="assignment_ind" label="Assign" @click="assignOpen = true" />
        <q-btn v-if="canTransfer && !['disposed', 'retired'].includes(asset.status)" color="primary" size="sm" outline icon="swap_horiz" label="Transfer" @click="transferOpen = true" />
        <q-btn v-if="canEdit && activeAssignment" color="teal" size="sm" outline icon="undo" label="Return" @click="returnAsset" />
        <q-btn v-if="canEdit" color="primary" size="sm" icon="edit" label="Edit" :to="{ name: 'assets' }" />
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <!-- Left column: identity & finance -->
      <div class="col-12 col-md-4">
        <q-card flat bordered class="q-mb-md">
          <q-card-section class="q-pb-none">
            <div class="text-subtitle2 text-weight-bold">Identity & ownership</div>
          </q-card-section>
          <q-card-section class="q-pt-sm">
            <q-list dense>
              <q-item><q-item-section><q-item-label caption>Category</q-item-label><q-item-label>{{ asset.category_name || '—' }}</q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Brand / Model</q-item-label><q-item-label>{{ [asset.brand, asset.model].filter(Boolean).join(' / ') || '—' }}</q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Serial number</q-item-label><q-item-label>{{ asset.serial_number || '—' }}</q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Supplier</q-item-label><q-item-label>{{ asset.supplier_name || '—' }}</q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Condition</q-item-label><q-item-label><StatusBadge :value="asset.condition" /></q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Warranty until</q-item-label><q-item-label>{{ date(asset.warranty_expiry_date) }}</q-item-label></q-item-section></q-item>
              <q-item v-if="asset.description"><q-item-section><q-item-label caption>Description</q-item-label><q-item-label>{{ asset.description }}</q-item-label></q-item-section></q-item>
            </q-list>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="q-mb-md">
          <q-card-section class="q-pb-none">
            <div class="text-subtitle2 text-weight-bold">Location</div>
          </q-card-section>
          <q-card-section class="q-pt-sm">
            <q-list dense>
              <q-item><q-item-section><q-item-label caption>Campus</q-item-label><q-item-label>{{ asset.campus_name || '—' }}</q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Faculty</q-item-label><q-item-label>{{ asset.faculty_name || '—' }}</q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Department</q-item-label><q-item-label>{{ asset.department_name || '—' }}</q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Building</q-item-label><q-item-label>{{ asset.building_name || '—' }}</q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Floor / Room</q-item-label><q-item-label>{{ [asset.floor_name, asset.room_name].filter(Boolean).join(' / ') || '—' }}</q-item-label></q-item-section></q-item>
            </q-list>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="q-mb-md">
          <q-card-section class="q-pb-none">
            <div class="text-subtitle2 text-weight-bold">Financial</div>
          </q-card-section>
          <q-card-section class="q-pt-sm">
            <q-list dense>
              <q-item><q-item-section><q-item-label caption>Purchase date</q-item-label><q-item-label>{{ date(asset.purchase_date) }}</q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Purchase price</q-item-label><q-item-label>{{ currency(asset.purchase_price) }}</q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Current value</q-item-label><q-item-label>{{ currency(asset.current_value) }}</q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Salvage value</q-item-label><q-item-label>{{ currency(asset.salvage_value) }}</q-item-label></q-item-section></q-item>
              <q-item><q-item-section><q-item-label caption>Book value</q-item-label><q-item-label class="text-weight-medium">{{ bookValue ? currency(bookValue.book_value) : currency(asset.current_value) }}</q-item-label></q-item-section></q-item>
            </q-list>
          </q-card-section>
        </q-card>

        <!-- QR & barcode -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section class="q-pb-none">
            <div class="text-subtitle2 text-weight-bold">Barcode & QR</div>
          </q-card-section>
          <q-card-section class="row items-center q-gutter-md q-pt-sm">
            <div class="column items-center">
              <canvas ref="barcodeCanvas" class="bg-white" style="padding: 8px; border-radius: 6px"></canvas>
              <div class="text-caption text-grey-6 q-mt-xs">{{ asset.barcode || '—' }}</div>
            </div>
            <div class="column items-center">
              <img v-if="qrDataUrl" :src="qrDataUrl" width="120" height="120" alt="QR code" />
              <div class="text-caption text-grey-6 q-mt-xs q-break-word" style="max-width: 140px">{{ asset.qr_code }}</div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Right column: timeline + files -->
      <div class="col-12 col-md-8">
        <q-card flat bordered class="q-mb-md">
          <q-card-section class="q-pb-none">
            <div class="text-subtitle2 text-weight-bold">Activity timeline</div>
          </q-card-section>
          <q-card-section>
            <div v-if="timelineLoading" class="q-gutter-sm">
              <q-skeleton type="rect" height="48px" v-for="i in 3" :key="i" />
            </div>
            <q-timeline v-else-if="timeline.length" color="primary">
              <q-timeline-entry v-for="(ev, i) in timeline" :key="i" :title="ev.title" :subtitle="date(ev.date, true)" :icon="timelineIcon(ev.type)" color="primary">
                <div class="text-body2 text-grey-8">{{ ev.description }}</div>
              </q-timeline-entry>
            </q-timeline>
            <EmptyState v-else icon="history" title="No activity yet" message="Assignments, transfers and maintenance will appear here." />
          </q-card-section>
        </q-card>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6">
            <q-card flat bordered>
              <q-card-section class="row items-center q-pb-none">
                <div class="text-subtitle2 text-weight-bold">Documents</div>
                <q-space />
                <q-btn v-if="canEdit" flat dense size="sm" color="primary" icon="upload" label="Upload" @click="uploadDocInput.click()" />
                <input ref="uploadDocInput" type="file" class="hidden" @change="uploadDocument" />
              </q-card-section>
              <q-card-section class="q-pt-sm">
                <q-list v-if="documents.length" dense separator>
                  <q-item v-for="d in documents" :key="d.id">
                    <q-item-section avatar><q-icon name="description" color="primary" /></q-item-section>
                    <q-item-section>
                      <q-item-label>{{ d.filename }}</q-item-label>
                      <q-item-label caption>{{ d.kind }} · {{ d.mime || '—' }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-btn v-if="canEdit" flat dense round size="sm" color="negative" icon="delete_outline" @click="removeDocument(d)" />
                    </q-item-section>
                  </q-item>
                </q-list>
                <EmptyState v-else icon="folder_open" title="No documents" message="Invoices, warranty papers and manuals go here." />
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-md-6">
            <q-card flat bordered>
              <q-card-section class="row items-center q-pb-none">
                <div class="text-subtitle2 text-weight-bold">Images</div>
                <q-space />
                <q-btn v-if="canEdit" flat dense size="sm" color="primary" icon="upload" label="Upload" @click="uploadImgInput.click()" />
                <input ref="uploadImgInput" type="file" accept="image/*" class="hidden" @change="uploadImage" />
              </q-card-section>
              <q-card-section class="q-pt-sm">
                <div v-if="images.length" class="row q-col-gutter-sm">
                  <div v-for="img in images" :key="img.id" class="col-6 col-sm-4">
                    <q-img :src="img.path" :alt="img.filename" class="rounded-borders" ratio="4/3" style="border: 1px solid rgba(0,0,0,.1)">
                      <q-btn v-if="canEdit" flat round dense color="negative" icon="delete_outline" size="sm" class="absolute-top-right" @click="removeImage(img)" />
                    </q-img>
                    <div class="text-caption text-grey-6 ellipsis">{{ img.filename }}</div>
                  </div>
                </div>
                <EmptyState v-else icon="image" title="No images" message="Photos of the asset can be attached here." />
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>
    </div>

    <!-- Assign dialog -->
    <q-dialog v-model="assignOpen" persistent>
      <q-card style="min-width: 380px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Assign asset</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="assignOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doAssign" class="column q-gutter-md">
            <q-select v-model="assignForm.assigned_to_user_id" :options="userOptions" label="Assign to *" dense outlined emit-value map-options options-dense :rules="[required]" />
            <q-input v-model="assignForm.expected_return_date" label="Expected return date" type="date" dense outlined />
            <q-input v-model="assignForm.notes" label="Notes" type="textarea" dense outlined autogrow />
            <div class="row justify-end q-gutter-sm">
              <q-btn label="Cancel" flat color="grey-7" @click="assignOpen = false" />
              <q-btn label="Assign" type="submit" color="primary" :loading="busy.assign" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Transfer dialog -->
    <q-dialog v-model="transferOpen" persistent>
      <q-card style="min-width: 420px; max-width: 640px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Transfer asset</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="transferOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doTransfer" class="row q-col-gutter-md">
            <q-select v-model="transferForm.to_campus_id" :options="campusOptions" label="To campus" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="transferForm.to_faculty_id" :options="facultyOptions" label="To faculty" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="transferForm.to_department_id" :options="departmentOptions" label="To department" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="transferForm.to_building_id" :options="buildingOptions" label="To building" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="transferForm.to_floor_id" :options="floorOptions" label="To floor" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="transferForm.to_room_id" :options="roomOptions" label="To room" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-input v-model="transferForm.notes" label="Notes" type="textarea" dense outlined autogrow class="col-12" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn label="Cancel" flat color="grey-7" @click="transferOpen = false" />
              <q-btn label="Request transfer" type="submit" color="primary" :loading="busy.transfer" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>

  <!-- Loading / error -->
  <div v-else-if="loading" class="page-container q-pa-md">
    <q-skeleton type="rect" height="120px" class="q-mb-sm" />
    <q-skeleton type="rect" height="200px" />
  </div>
  <ErrorState v-else :message="error" @retry="load" />
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import StatusBadge from 'src/components/common/StatusBadge.vue'
import { assetService } from 'src/services/assets.service'
import { assignmentService, transferService } from 'src/services/operations.service'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { currency, date } from 'src/utils/format'

const route = useRoute()
const $q = useQuasar()
const authStore = useAuthStore()
const { campuses, faculties, departments, buildings, floors, rooms, users, opts } = useOptions()
const campusOptions = computed(() => opts(campuses.value))
const facultyOptions = computed(() => opts(faculties.value))
const departmentOptions = computed(() => opts(departments.value))
const buildingOptions = computed(() => opts(buildings.value))
const floorOptions = computed(() => opts(floors.value))
const roomOptions = computed(() => opts(rooms.value))
const userOptions = computed(() => opts(users.value))

const asset = ref(null)
const loading = ref(true)
const error = ref('')
const timeline = ref([])
const timelineLoading = ref(false)
const documents = ref([])
const images = ref([])
const bookValue = ref(null)
const activeAssignment = ref(null)
const qrDataUrl = ref('')
const barcodeCanvas = ref(null)

const assignOpen = ref(false)
const transferOpen = ref(false)
const assignForm = reactive({ assigned_to_user_id: null, expected_return_date: null, notes: '' })
const transferForm = reactive({ to_campus_id: null, to_faculty_id: null, to_department_id: null, to_building_id: null, to_floor_id: null, to_room_id: null, notes: '' })
const busy = reactive({ assign: false, transfer: false, return: false })
const uploadDocInput = ref(null)
const uploadImgInput = ref(null)

const required = (v) => (v !== null && v !== undefined && String(v).trim() !== '') || 'This field is required'
const canAssign = computed(() => authStore.hasPermission('assets.assign'))
const canTransfer = computed(() => authStore.hasPermission('assets.transfer'))
const canEdit = computed(() => authStore.hasPermission('assets.update'))

function timelineIcon(type) {
  return { location: 'place', assignment: 'assignment_ind', maintenance: 'build', transfer: 'swap_horiz', request: 'request_page' }[type] || 'history'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await assetService.get(route.params.id)
    asset.value = data
    loadAux()
  } catch (e) {
    error.value = e.message || 'Asset not found.'
  } finally {
    loading.value = false
  }
}

async function loadAux() {
  const id = asset.value.id
  timelineLoading.value = true
  try {
    const [tl, docs, imgs, bv, assignments] = await Promise.all([
      assetService.timeline(id),
      assetService.documents(id),
      assetService.images(id),
      assetService.bookValue(id).catch(() => null),
      assignmentService.list({ asset_id: id, status: 'active', per_page: 5 }),
    ])
    timeline.value = tl.data || []
    documents.value = docs.data?.data || []
    images.value = imgs.data?.data || []
    bookValue.value = bv.data || null
    activeAssignment.value = assignments.data?.data?.[0] || null
    renderCodes()
  } catch (e) {
    $q.notify({ type: 'warning', message: 'Some details could not be loaded.' })
  } finally {
    timelineLoading.value = false
  }
}

function renderCodes() {
  if (asset.value?.barcode && barcodeCanvas.value) {
    try {
      JsBarcode(barcodeCanvas.value, asset.value.barcode, { format: 'CODE128', displayValue: true, width: 2, height: 48 })
    } catch { /* keep canvas blank */ }
  }
  if (asset.value?.qr_code) {
    QRCode.toDataURL(asset.value.qr_code, { width: 240, margin: 1 }).then((url) => { qrDataUrl.value = url }).catch(() => {})
  }
}

async function doAssign() {
  busy.assign = true
  try {
    await assignmentService.assign(asset.value.id, { ...assignForm })
    assignOpen.value = false
    $q.notify({ type: 'positive', message: 'Asset assigned.' })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    busy.assign = false
  }
}

async function returnAsset() {
  $q.dialog({
    title: 'Return asset',
    message: `Return “${asset.value.name}” from ${activeAssignment.value?.assignee_name || 'the assignee'}?`,
    cancel: true, persistent: true,
  }).onOk(async () => {
    busy.return = true
    try {
      await assignmentService.returnAsset(activeAssignment.value.id, { condition_on_return: 'good' })
      $q.notify({ type: 'positive', message: 'Asset returned.' })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.message || 'Return failed.' })
    } finally {
      busy.return = false
    }
  })
}

async function doTransfer() {
  busy.transfer = true
  try {
    await transferService.store(asset.value.id, { ...transferForm })
    transferOpen.value = false
    $q.notify({ type: 'positive', message: 'Transfer request created.' })
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || 'Transfer failed.' })
  } finally {
    busy.transfer = false
  }
}

async function uploadDocument(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    await assetService.uploadDocument(asset.value.id, { kind: 'other', file: { filename: file.name, mime: file.type, size: file.size } })
    $q.notify({ type: 'positive', message: 'Document uploaded.' })
    documents.value = (await assetService.documents(asset.value.id)).data?.data || []
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message || 'Upload failed.' })
  }
}

async function uploadImage(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    await assetService.uploadImage(asset.value.id, { file: { filename: file.name, path: URL.createObjectURL(file), mime: file.type, size: file.size } })
    $q.notify({ type: 'positive', message: 'Image uploaded.' })
    images.value = (await assetService.images(asset.value.id)).data?.data || []
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message || 'Upload failed.' })
  }
}

function removeDocument(doc) {
  $q.dialog({ title: 'Delete document', message: `Delete “${doc.filename}”?`, cancel: true, persistent: true, color: 'negative' })
    .onOk(async () => {
      await assetService.deleteDocument(doc.id)
      documents.value = (await assetService.documents(asset.value.id)).data?.data || []
      $q.notify({ type: 'positive', message: 'Document deleted.' })
    })
}

function removeImage(img) {
  $q.dialog({ title: 'Delete image', message: `Delete “${img.filename}”?`, cancel: true, persistent: true, color: 'negative' })
    .onOk(async () => {
      await assetService.deleteImage(img.id)
      images.value = (await assetService.images(asset.value.id)).data?.data || []
      $q.notify({ type: 'positive', message: 'Image deleted.' })
    })
}

onMounted(load)
</script>
