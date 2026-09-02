<template>
  <div class="auth-bg">
    <!-- Language Switcher in the top bar of login screen -->
    <div class="auth-lang-picker absolute-top-right q-pa-md">
      <LanguageSwitcher flat text-color="white" />
    </div>

    <div class="row items-center justify-center full-width q-px-md q-py-lg auth-split">
      <!-- Brand hero panel (reference-style) — hidden below 960px -->
      <div class="auth-hero gt-sm">
        <div class="auth-hero__logo q-mb-lg">
          <q-icon name="account_balance" size="34px" />
        </div>

        <div class="text-h5 text-weight-bold">{{ t('common.universityName') }}</div>
        <div class="text-subtitle2 hero-dim q-mb-lg">{{ t('common.appName') }}</div>

        <div class="auth-hero__tagline">
          {{ t('auth.tagline1') }}<br />
          {{ t('auth.tagline2') }}<br />
          {{ t('auth.tagline3') }}
        </div>
        <div class="auth-hero__desc">{{ t('auth.heroDesc') }}</div>

        <div class="column q-gutter-sm q-mt-xl">
          <div class="auth-hero__chip">
            <q-icon name="inventory_2" size="20px" />
            <div>
              <div class="text-subtitle2 text-weight-bold">{{ t('assets.title') }}</div>
              <div class="text-caption hero-dim-2">{{ t('assets.subtitle') }}</div>
            </div>
          </div>
          <div class="auth-hero__chip">
            <q-icon name="build" size="20px" />
            <div>
              <div class="text-subtitle2 text-weight-bold">{{ t('maintenance.title') }}</div>
              <div class="text-caption hero-dim-2">{{ t('maintenance.subtitle') }}</div>
            </div>
          </div>
          <div class="auth-hero__chip">
            <q-icon name="badge" size="20px" />
            <div>
              <div class="text-subtitle2 text-weight-bold">{{ t('hr.title') }}</div>
              <div class="text-caption hero-dim-2">{{ t('hr.subtitle') }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sign-in card -->
      <q-card class="auth-card q-pa-lg ku-shadow-md">
        <div class="column items-center q-mb-lg">
          <div class="auth-card__logo q-mb-md">
            <q-icon name="account_balance" size="30px" />
          </div>
          <div class="text-h6 text-weight-bold text-center">{{ t('auth.welcomeBack') }}</div>
          <div class="text-subtitle2 text-grey-7 text-center">{{ t('auth.welcomeBackSub') }}</div>
        </div>

        <q-form @submit="submit" class="q-gutter-md" greedy>
          <q-input
            v-model="form.login"
            :label="t('auth.usernameOrEmail')"
            outlined
            dense
            autofocus
            autocomplete="username"
            :rules="[(v) => !!v || t('auth.loginRequired')]"
            @keyup.enter="submit"
          >
            <template #prepend><q-icon name="person" /></template>
          </q-input>

          <q-input
            v-model="form.password"
            :label="t('auth.password')"
            :type="showPassword ? 'text' : 'password'"
            outlined
            dense
            autocomplete="current-password"
            :rules="[(v) => !!v || t('auth.passwordRequired')]"
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
            :label="t('auth.signIn')"
            type="submit"
            color="primary"
            icon-right="arrow_forward"
            class="full-width auth-card__submit"
            size="lg"
            unelevated
            :loading="authStore.loading"
          >
            <template #loading>
              <q-spinner-dots class="on-left" /> {{ t('auth.signingIn') }}
            </template>
          </q-btn>
        </q-form>

        <q-separator class="q-my-lg" />

        <div class="text-caption text-grey-6 text-center">
          {{ t('auth.demoAccess') }}: <code class="bg-grey-3 q-px-xs rounded-borders">superadmin</code> /
          <code class="bg-grey-3 q-px-xs rounded-borders">password</code>
        </div>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from 'src/stores/auth'
import LanguageSwitcher from 'src/components/common/LanguageSwitcher.vue'

const { t } = useI18n()
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
    error.value = e.message || t('auth.invalidCredentials')
  }
}
</script>

<style lang="sass" scoped>
.hero-dim
  color: rgba(255, 255, 255, .62)

.hero-dim-2
  color: rgba(255, 255, 255, .55)

.auth-split
  min-height: 100vh

.auth-hero
  padding: 40px

.auth-card
  &__logo
    width: 60px
    height: 60px
    border-radius: 16px
    display: flex
    align-items: center
    justify-content: center
    background: linear-gradient(160deg, #F3D48B 0%, #C8862D 100%)
    color: #0B1626
    box-shadow: 0 8px 22px rgba(200, 134, 45, .4)

  &__submit
    letter-spacing: .4px
</style>
