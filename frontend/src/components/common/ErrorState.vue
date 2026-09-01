<template>
  <div class="column items-center justify-center q-pa-xl text-center">
    <q-icon name="cloud_off" size="64px" color="negative" />
    <div class="text-subtitle1 text-grey-7 q-mt-md">{{ t('common.error') }}</div>
    <div class="text-body2 text-grey-6 q-mt-xs" style="max-width: 480px">{{ message || t('common.loadFailed') }}</div>
    <q-btn :label="t('common.tryAgain')" color="primary" outline class="q-mt-md" @click="$emit('retry')" />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  message: { type: String, default: '' },
})
defineEmits(['retry'])
</script>
