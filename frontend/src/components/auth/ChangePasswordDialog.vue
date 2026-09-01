<template>
  <q-card style="min-width: 380px; max-width: 480px" class="q-pa-md">
    <q-card-section class="q-pb-none">
      <div class="text-h6 row items-center">
        <q-icon name="lock" class="q-mr-sm text-primary" />
        {{ t('auth.changePassword') }}
      </div>
      <div class="text-caption text-grey-6">{{ t('auth.changePasswordDesc') }}</div>
    </q-card-section>

    <q-card-section>
      <q-form @submit="submit" class="q-gutter-md">
        <q-input
          v-model="form.current_password"
          :label="t('auth.currentPassword')"
          :type="showPwd ? 'text' : 'password'"
          outlined
          dense
          :rules="[requiredRule]"
          autocomplete="current-password"
        >
          <template #append>
            <q-icon :name="showPwd ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showPwd = !showPwd" />
          </template>
        </q-input>
        <q-input
          v-model="form.new_password"
          :label="t('auth.newPassword')"
          :type="showPwd ? 'text' : 'password'"
          outlined
          dense
          :rules="[requiredRule, (v) => v.length >= 8 || t('auth.passwordMinLength')]"
          autocomplete="new-password"
        />
        <q-input
          v-model="form.new_password_confirmation"
          :label="t('auth.confirmNewPassword')"
          :type="showPwd ? 'text' : 'password'"
          outlined
          dense
          :rules="[(v) => v === form.new_password || t('auth.passwordMismatch')]"
          autocomplete="new-password"
        />

        <q-banner v-if="error" class="bg-negative text-white rounded-borders q-mb-sm">
          {{ error }}
        </q-banner>

        <div class="row justify-end q-gutter-sm">
          <q-btn :label="t('common.cancel')" flat color="grey-7" v-close-popup />
          <q-btn :label="t('auth.updatePassword')" color="primary" type="submit" :loading="loading" />
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'

const emit = defineEmits(['done'])
const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()

const form = ref({
  current_password: '',
  new_password: '',
  new_password_confirmation: '',
})
const showPwd = ref(false)
const loading = ref(false)
const error = ref(null)

const requiredRule = (v) => !!v || t('common.required')

async function submit() {
  loading.value = true
  error.value = null
  try {
    await authStore.changePassword(form.value)
    $q.notify({ type: 'positive', message: t('auth.passwordChangedSuccess') })
    emit('done')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
