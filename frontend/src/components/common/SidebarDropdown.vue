<template>
  <div class="sb-group" :class="{ 'sb-group--open': expanded, 'sb-group--active': hasActiveChild }">
    <!-- Mini rail: the parent becomes a hover fly-out instead of an accordion -->
    <template v-if="mini">
      <button type="button" class="sb-group__rail" :class="{ 'is-active': hasActiveChild }" :aria-label="label">
        <q-icon :name="icon" size="20px" />
        <q-menu anchor="top end" self="top start" class="sb-flyout">
          <q-list dense style="min-width: 210px">
            <q-item-label header>{{ label }}</q-item-label>
            <q-item
              v-for="item in items"
              :key="item.name"
              v-ripple
              clickable
              :to="{ name: item.name }"
              :active="isActive(item)"
              active-class="sb-item--active"
            >
              <q-item-section avatar><q-icon :name="item.icon" size="18px" /></q-item-section>
              <q-item-section>{{ item.title }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </button>
    </template>

    <template v-else>
      <button
        type="button"
        class="sb-group__header"
        :aria-expanded="String(expanded)"
        @click="$emit('toggle')"
      >
        <q-icon :name="icon" size="19px" class="sb-group__icon" />
        <span class="sb-group__label">{{ label }}</span>
        <q-badge v-if="!expanded && activeCount" color="primary" rounded class="sb-group__dot" />
        <q-icon name="expand_more" size="18px" class="sb-group__chevron" />
      </button>

      <!-- max-height transition keeps the expand/collapse smooth without
           measuring the DOM on every frame -->
      <transition name="sb-collapse">
        <ul v-show="expanded" class="sb-group__items">
          <li v-for="item in items" :key="item.name">
            <router-link
              :to="{ name: item.name }"
              class="sb-item"
              :class="{ 'sb-item--active': isActive(item) }"
            >
              <q-icon :name="item.icon" size="17px" class="sb-item__icon" />
              <span class="sb-item__label">{{ item.title }}</span>
            </router-link>
          </li>
        </ul>
      </transition>
    </template>
  </div>
</template>

<script setup>
/**
 * ---------------------------------------------------------------------------
 * SidebarDropdown — one expandable module in the sidebar.
 * ---------------------------------------------------------------------------
 *
 * The parent owns the expanded state (so it can auto-open the group that holds
 * the current route, and open every matching group while the user is searching)
 * and this component only renders and animates it.
 *
 * In the "mini" sidebar style the accordion would have nowhere to expand, so
 * the group turns into a hover fly-out menu instead — the same items, the same
 * active highlighting, no layout shift.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  label: { type: String, required: true },
  icon: { type: String, default: 'folder' },
  /** [{ name (route name), title, icon }] */
  items: { type: Array, default: () => [] },
  expanded: { type: Boolean, default: false },
  mini: { type: Boolean, default: false },
})

defineEmits(['toggle'])

const route = useRoute()

const isActive = (item) => route.name === item.name
const activeCount = computed(() => props.items.filter(isActive).length)
const hasActiveChild = computed(() => activeCount.value > 0)
</script>

<style lang="sass" scoped>
.sb-group
  margin: 0 8px 2px

  &__header
    display: flex
    align-items: center
    gap: 10px
    width: 100%
    padding: 8px 10px
    border: none
    background: transparent
    border-radius: var(--app-radius)
    cursor: pointer
    font: inherit
    font-size: 13px
    font-weight: 600
    color: var(--app-text-primary)
    transition: background-color .14s ease, color .14s ease

    &:hover
      background: var(--app-hover)

    &:focus-visible
      outline: 2px solid var(--q-primary)
      outline-offset: -2px

  &__rail
    display: flex
    align-items: center
    justify-content: center
    width: 100%
    height: 40px
    border: none
    background: transparent
    border-radius: var(--app-radius)
    cursor: pointer
    color: var(--app-text-secondary)

    &:hover
      background: var(--app-hover)
      color: var(--q-primary)

    &.is-active
      background: color-mix(in srgb, var(--q-primary) 12%, transparent)
      color: var(--q-primary)

  &__icon
    color: var(--app-text-secondary)
    flex: 0 0 auto

  &__label
    flex: 1
    text-align: start
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap

  &__dot
    width: 7px
    height: 7px
    min-width: 7px
    padding: 0

  &__chevron
    color: var(--app-text-secondary)
    transition: transform .18s ease

  &--open &__chevron
    transform: rotate(180deg)

  &--active &__header,
  &--active &__icon
    color: var(--q-primary)

  &__items
    list-style: none
    margin: 2px 0 4px
    padding: 0 0 0 14px
    border-inline-start: 1px solid var(--app-border)
    margin-inline-start: 18px

.sb-item
  display: flex
  align-items: center
  gap: 9px
  padding: 7px 10px
  border-radius: var(--app-radius)
  font-size: 12.5px
  font-weight: 500
  color: var(--app-text-secondary)
  text-decoration: none
  transition: background-color .14s ease, color .14s ease

  &:hover
    background: var(--app-hover)
    color: var(--app-text-primary)
    text-decoration: none

  &__icon
    flex: 0 0 auto
    opacity: .85

  &__label
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap

  &--active
    background: color-mix(in srgb, var(--q-primary) 12%, transparent)
    color: var(--q-primary)
    font-weight: 700

// Smooth expand / collapse
.sb-collapse-enter-active,
.sb-collapse-leave-active
  transition: max-height .2s ease, opacity .18s ease
  overflow: hidden

.sb-collapse-enter-from,
.sb-collapse-leave-to
  max-height: 0
  opacity: 0

.sb-collapse-enter-to,
.sb-collapse-leave-from
  max-height: 640px
  opacity: 1
</style>
