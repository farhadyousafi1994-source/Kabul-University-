<template>
  <button
    type="button"
    class="tc"
    :class="{ 'tc--active': selected }"
    :aria-pressed="selected"
    :aria-label="`${name}${selected ? ' (selected)' : ''}`"
    :title="name"
    @click="$emit('select', scheme.id)"
    @keydown.enter.prevent="$emit('select', scheme.id)"
    @keydown.space.prevent="$emit('select', scheme.id)"
  >
    <span class="tc__strips">
      <span v-for="(color, i) in strips" :key="i" class="tc__strip" :style="{ background: color }" />
    </span>

    <span class="tc__foot">
      <span class="tc__name">{{ name }}</span>
      <q-badge v-if="scheme.recommended" color="primary" :label="recommendedLabel" class="tc__badge" />
      <q-icon v-if="selected" name="check_circle" size="16px" class="tc__check" />
    </span>
  </button>
</template>

<script setup>
/**
 * ThemeCard — one colour-scheme swatch: four colour strips, the scheme name,
 * an optional "Recommended" badge and the selected indicator.
 *
 * Rendered as a real <button> so it is keyboard focusable, announces its
 * pressed state to screen readers and shows a visible focus ring.
 */
import { computed } from 'vue'

const props = defineProps({
  scheme: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  recommendedLabel: { type: String, default: 'Recommended' },
})

defineEmits(['select'])

const strips = computed(() => {
  const list = props.scheme.swatch?.length ? props.scheme.swatch : []
  return list.slice(0, 4)
})

const name = computed(() => props.scheme.name)
</script>

<style lang="sass" scoped>
.tc
  display: flex
  flex-direction: column
  gap: 6px
  width: 100%
  padding: 6px
  text-align: start
  cursor: pointer
  background: var(--app-card)
  border: 1px solid var(--app-border)
  border-radius: var(--app-radius-lg)
  box-shadow: var(--ku-shadow-sm)
  transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease
  font-family: inherit

  &:hover
    transform: translateY(-2px)
    box-shadow: var(--ku-shadow-md)
    border-color: color-mix(in srgb, var(--app-primary) 40%, var(--app-border))

  &:focus-visible
    outline: 2px solid var(--app-primary)
    outline-offset: 2px

  &--active
    border-color: var(--app-primary)
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-primary) 22%, transparent)

  &__strips
    display: flex
    gap: 2px
    height: 34px
    border-radius: var(--app-radius)
    overflow: hidden

  &__strip
    flex: 1
    min-width: 0

  &__foot
    display: flex
    align-items: center
    gap: 4px
    min-width: 0

  &__name
    font-size: 11.5px
    font-weight: 700
    color: var(--app-text-primary)
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

  &__badge
    font-size: 9px
    padding: 1px 5px
    border-radius: 999px

  &__check
    margin-inline-start: auto
    color: var(--app-primary)
    flex: 0 0 auto
</style>
