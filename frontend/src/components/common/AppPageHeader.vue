<template>
  <div class="ku-hero q-px-md q-py-md print-hide">
    <div class="row items-center justify-between no-wrap q-col-gutter-sm">
      <div class="row items-center no-wrap">
        <div v-if="icon" class="ku-hero__icon-tile q-mr-md">
          <q-icon :name="icon" size="28px" />
        </div>
        <div class="min-width-0">
          <div class="ku-hero__title ellipsis-2-lines">{{ title }}</div>
          <div v-if="subtitle" class="ku-hero__subtitle ellipsis-2-lines">{{ subtitle }}</div>
          <div v-if="resolvedMeta.length" class="row items-center q-gutter-xs q-mt-xs">
            <span v-for="(m, i) in resolvedMeta" :key="i" class="ku-hero__meta">
              <q-icon v-if="m.icon" :name="m.icon" size="14px" />
              {{ m.label }}
            </span>
          </div>
        </div>
      </div>
      <div class="ku-hero__actions gt-xs">
        <slot name="actions" />
      </div>
    </div>
    <!-- Actions move below the title on phones so buttons never squeeze the heading -->
    <div v-if="$slots.actions" class="lt-sm q-mt-sm">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  /** Optional metadata chips shown under the subtitle: 'text' or { icon, label }. */
  meta: { type: Array, default: () => [] },
})

const resolvedMeta = computed(() =>
  props.meta.map((m) => (typeof m === 'string' ? { label: m } : m)).filter((m) => m.label),
)
</script>

<style lang="sass" scoped>
.min-width-0
  min-width: 0
</style>
