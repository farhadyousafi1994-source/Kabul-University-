<template>
  <div class="column items-center justify-center q-pa-xl text-center">
    <div class="empty-state__icon">
      <q-icon :name="icon" size="34px" />
    </div>
    <div class="text-subtitle1 text-grey-6 q-mt-md">{{ title || t('common.nothingHere') }}</div>
    <div v-if="message" class="text-body2 text-grey-5 q-mt-xs" style="max-width: 420px">
      {{ message }}
    </div>
    <q-btn v-if="actionLabel" :label="actionLabel" color="primary" class="q-mt-md" @click="$emit('action')" />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  icon: { type: String, default: 'inbox' },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
})
defineEmits(['action'])
</script>

<style lang="sass" scoped>
.empty-state__icon
  width: 68px
  height: 68px
  border-radius: 50%
  display: flex
  align-items: center
  justify-content: center
  background: color-mix(in srgb, var(--ku-ink-soft) 8%, transparent)
  color: var(--ku-ink-soft)
</style>
