<template>
  <div class="column items-center justify-center" style="min-height: 100vh">
    <q-icon name="search_off" size="96px" color="grey-5" />
    <div class="text-h4 text-grey-7 q-mt-md">404</div>
    <div class="text-subtitle1 text-grey-6 q-mt-sm">
      {{ denied ? 'You do not have permission to access this page.' : 'The page you are looking for does not exist.' }}
    </div>
    <q-btn
      class="q-mt-lg"
      color="primary"
      :label="authStore.isAuthenticated ? 'Back to dashboard' : 'Sign in'"
      :to="authStore.isAuthenticated ? { name: 'dashboard' } : { name: 'login' }"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'

const route = useRoute()
const authStore = useAuthStore()
const denied = computed(() => route.query.denied === '1')
</script>
