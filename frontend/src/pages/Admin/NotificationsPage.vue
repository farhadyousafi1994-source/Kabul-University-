<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader title="Notifications" subtitle="In-app alerts and approvals awaiting you" icon="notifications">
      <template #actions>
        <q-btn color="primary" outline size="sm" icon="done_all" label="Mark all read" :disable="!items.length" @click="markAll" />
      </template>
    </AppPageHeader>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <q-list v-else-if="items.length" bordered separator class="rounded-borders">
      <q-item v-for="n in items" :key="n.id" clickable :class="{ 'bg-primary/5': !n.read_at }" @click="markRead(n)">
        <q-item-section avatar>
          <q-icon :name="n.icon || 'notifications'" :color="n.read_at ? 'grey-5' : 'primary'" size="28px" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ n.title }}</q-item-label>
          <q-item-label caption>{{ n.message }}</q-item-label>
          <q-item-label caption class="text-caption">{{ timeAgo(n.created_at) }}</q-item-label>
        </q-item-section>
        <q-item-section side v-if="!n.read_at">
          <q-badge color="primary" />
        </q-item-section>
      </q-item>
    </q-list>
    <EmptyState v-else icon="notifications_off" title="No notifications" message="You are all caught up." />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { notificationService } from 'src/services/notifications.service'
import { timeAgo } from 'src/utils/format'

const $q = useQuasar()
const items = ref([])
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await notificationService.list()
    items.value = data?.data || []
  } catch (e) {
    error.value = e.message || 'Failed to load notifications.'
  } finally {
    loading.value = false
  }
}

async function markRead(n) {
  if (n.read_at) return
  try {
    await notificationService.markRead(n.id)
    n.read_at = new Date().toISOString()
  } catch { /* non-critical */ }
}

async function markAll() {
  try {
    await notificationService.markAllRead()
    items.value.forEach((n) => { n.read_at = new Date().toISOString() })
    $q.notify({ type: 'positive', message: 'All notifications marked as read.' })
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || 'Failed.' })
  }
}

onMounted(load)
</script>
