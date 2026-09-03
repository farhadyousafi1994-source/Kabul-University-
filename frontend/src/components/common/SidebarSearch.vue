<template>
  <div class="sb-search">
    <q-icon name="search" size="17px" class="sb-search__icon" />
    <input
      :value="modelValue"
      type="text"
      class="sb-search__input"
      :placeholder="t('nav.searchMenu')"
      :aria-label="t('nav.searchMenu')"
      @input="$emit('update:modelValue', $event.target.value)"
      @keydown.esc.prevent="$emit('update:modelValue', '')"
    />
    <button
      v-if="modelValue"
      type="button"
      class="sb-search__clear"
      :aria-label="t('common.reset')"
      @click="$emit('update:modelValue', '')"
    >
      <q-icon name="close" size="15px" />
    </button>
  </div>
</template>

<script setup>
/**
 * Sidebar menu filter. Purely local (no requests, no reloads) — the parent
 * filters its menu model against this term, which is why typing can never
 * flicker or cost a round trip. Esc clears and restores the full menu.
 */
import { useI18n } from 'vue-i18n'

defineProps({ modelValue: { type: String, default: '' } })
defineEmits(['update:modelValue'])

const { t } = useI18n()
</script>

<style lang="sass" scoped>
.sb-search
  display: flex
  align-items: center
  gap: 8px
  margin: 10px 12px
  padding: 0 10px
  height: 34px
  border-radius: var(--app-radius)
  border: 1px solid var(--app-border)
  background: var(--app-background)
  transition: border-color .15s ease, box-shadow .15s ease

  &:focus-within
    border-color: var(--q-primary)
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--q-primary) 14%, transparent)

  &__icon
    color: var(--app-text-secondary)
    flex: 0 0 auto

  &__input
    flex: 1
    min-width: 0
    border: none
    outline: none
    background: transparent
    font: inherit
    font-size: 13px
    color: var(--app-text-primary)

    &::placeholder
      color: var(--app-text-secondary)

  &__clear
    border: none
    background: transparent
    padding: 0
    display: flex
    cursor: pointer
    color: var(--app-text-secondary)

    &:hover
      color: var(--app-text-primary)
</style>
