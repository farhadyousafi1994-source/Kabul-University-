<template>
  <div class="row items-center justify-between q-mb-md no-wrap">
    <div class="row items-center no-wrap">
      <q-icon v-if="icon" :name="icon" size="30px" color="primary" class="q-mr-sm" />
      <div>
        <div class="text-h6 text-weight-bold q-mb-none">{{ title }}</div>
        <div v-if="subtitle" class="text-caption text-grey-6">{{ subtitle }}</div>
      </div>
    </div>
    <div class="row items-center q-gutter-sm no-wrap">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
})
</script>
