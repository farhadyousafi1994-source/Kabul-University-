<template>
  <q-card class="stat-card" :class="[`bg-${tone}`, { 'stat-card--small': small }]">
    <q-card-section class="row items-center no-wrap">
      <q-icon :name="icon" size="34px" :color="color" class="q-mr-md" />
      <div class="col">
        <div class="text-h6 text-weight-bold q-mb-none" :class="{ 'stat-card__value--small': small }">{{ value }}</div>
        <div class="text-caption text-grey-7">{{ label }}</div>
      </div>
      <div v-if="side" class="stat-card__side text-caption text-weight-bold" :class="`text-${color}`">
        {{ side }}
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
  /** Optional small side annotation (e.g. a percentage). */
  side: { type: String, default: '' },
  /** Compact value font for long numbers (currencies etc.). */
  small: { type: Boolean, default: false },
})
</script>

<style lang="sass" scoped>
.stat-card
  transition: transform .15s ease, box-shadow .15s ease

  &:hover
    transform: translateY(-2px)
    box-shadow: 0 6px 18px rgba(0, 0, 0, .08)

  &__value--small
    font-size: 20px !important

  &__side
    font-size: 14px
    padding: 4px 8px
    border-radius: 8px
    background: rgba(0, 0, 0, .04)

:global(.body--dark)
  .stat-card__side
    background: rgba(255, 255, 255, .08)
</style>
