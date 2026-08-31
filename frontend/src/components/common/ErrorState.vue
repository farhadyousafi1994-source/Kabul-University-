<template>
  <div class="column items-center justify-center q-pa-xl text-center">
    <q-icon name="cloud_off" size="64px" color="negative" />
    <div class="text-subtitle1 text-grey-7 q-mt-md">Something went wrong</div>
    <div class="text-body2 text-grey-6 q-mt-xs" style="max-width: 480px">{{ message }}</div>
    <q-btn label="Try again" color="primary" outline class="q-mt-md" @click="$emit('retry')" />
  </div>
</template>

<script setup>
defineProps({
  message: { type: String, default: 'We could not load this data. Please try again.' },
})
defineEmits(['retry'])
</script>
