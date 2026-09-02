<template>
  <q-card flat bordered class="ft-card full-height">
    <q-card-section class="ft-card__head q-pb-none">
      <q-icon :name="icon" size="18px" class="ft-card__icon q-mr-sm" />
      <div class="col min-width-0">
        <div class="ft-card__title ellipsis">{{ title }}</div>
        <div v-if="hint" class="ft-card__hint ellipsis-2-lines">{{ hint }}</div>
      </div>
      <q-btn v-if="$slots.action" flat dense round size="sm" icon="tune">
        <q-menu anchor="bottom end" self="top end" class="q-pa-sm">
          <slot name="action" />
        </q-menu>
      </q-btn>
    </q-card-section>
    <q-card-section class="ft-card__body">
      <slot />
    </q-card-section>
  </q-card>
</template>

<script setup>
/**
 * FineTuneCard — the compact "Icon + Title + control" tile used by every
 * setting on the Theme & Appearance page. Keeps the grid visually consistent
 * (same head height, same icon treatment, same padding) without repeating the
 * markup thirteen times.
 */
defineProps({
  icon: { type: String, default: 'tune' },
  title: { type: String, required: true },
  hint: { type: String, default: '' },
})
</script>

<style lang="sass" scoped>
.ft-card
  border-radius: var(--app-radius-lg)
  border-color: var(--app-border)
  transition: border-color .15s ease, box-shadow .15s ease

  &:hover
    border-color: color-mix(in srgb, var(--app-primary) 35%, var(--app-border))
    box-shadow: var(--ku-shadow-sm)

  &__head
    display: flex
    align-items: flex-start
    padding: 10px 12px 0

  &__icon
    color: var(--app-primary)
    margin-top: 1px

  &__title
    font-size: 12.5px
    font-weight: 700
    line-height: 1.25
    color: var(--app-text-primary)

  &__hint
    font-size: 11px
    line-height: 1.35
    color: var(--app-text-secondary)
    margin-top: 1px

  &__body
    padding: 10px 12px 12px

.min-width-0
  min-width: 0
</style>
