<template>
  <q-card class="stat-card" :class="`bg-${tone}`">
    <q-card-section class="row items-center no-wrap">
      <q-icon :name="icon" size="34px" :color="color" class="q-mr-md" />
      <div class="col">
        <div class="text-h6 text-weight-bold q-mb-none">{{ value }}</div>
        <div class="text-caption text-grey-7">{{ label }}</div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  icon: { type: String, default: 'inventory_2' },
  color: { type: String, default: 'primary' },
  tone: { type: String, default: 'white' },
})
</script>
