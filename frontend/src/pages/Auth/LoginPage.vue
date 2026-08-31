<template>
  <div class="auth-bg">
    <q-card class="auth-card q-pa-lg shadow-8">
      <div class="column items-center q-mb-lg">
        <q-avatar size="72px" color="white" text-color="primary" class="shadow-4 q-mb-md">
          <q-icon name="account_balance" size="44px" />
        </q-avatar>
        <div class="text-h6 text-weight-bold text-center">Kabul University</div>
        <div class="text-subtitle2 text-grey-7 text-center">Asset Management System</div>
      </div>

      <q-form @submit="submit" class="q-gutter-md" greedy>
        <q-input
          v-model="form.login"
          label="Username or email"
          outlined
          dense
          autofocus
          autocomplete="username"
          :rules="[(v) => !!v || 'Username or email is required']"
          @keyup.enter="submit"
        >
          <template #prepend><q-icon name="person" /></template>
        </q-input>

        <q-input
          v-model="form.password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          outlined
          dense
          autocomplete="current-password"
          :rules="[(v) => !!v || 'Password is required']"
          @keyup.enter="submit"
        >
          <template #prepend><q-icon name="lock" /></template>
          <template #append>
            <q-icon
              :name="showPassword ? 'visibility_off' : 'visibility'"
              class="cursor-pointer"
              @click="showPassword = !showPassword"
            />
          </template>
        </q-input>

        <q-banner v-if="error" class="bg-negative text-white rounded-borders">
          <template #avatar><q-icon name="error_outline" /></template>
          {{ error }}
        </q-banner>

        <q-btn
          label="Sign in"
          type="submit"
          color="primary"
          class="full-width"
          size="lg"
          :loading="authStore.loading"
        >
          <template #loading>
            <q-spinner-facebook class="on-left" /> Signing in…
          </template>
        </q-btn>
      </q-form>

      <div class="text-caption text-grey-6 text-center q-mt-lg">
        Demo access: <code class="bg-grey-3 q-px-xs rounded-borders">superadmin</code> /
        <code class="bg-grey-3 q-px-xs rounded-borders">password</code>
      </div>
    </q-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const form = ref({ login: '', password: '' })
const showPassword = ref(false)
const error = ref(null)

async function submit() {
  if (!form.value.login || !form.value.password) return
  error.value = null
  try {
    await authStore.login({
      login: form.value.login.trim(),
      password: form.value.password,
    })
    router.push(route.query.redirect || { name: 'dashboard' })
  } catch (e) {
    error.value = e.message || 'Invalid credentials. Please try again.'
  }
}
</script>
