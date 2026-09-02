<template>
  <div class="column items-center justify-center q-pa-xl text-center">
    <div class="error-state__icon">
      <q-icon name="cloud_off" size="34px" />
    </div>
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

<style lang="sass" scoped>
.error-state__icon
  width: 68px
  height: 68px
  border-radius: 50%
  display: flex
  align-items: center
  justify-content: center
  background: color-mix(in srgb, var(--q-negative) 10%, transparent)
  color: var(--q-negative)
</style>
