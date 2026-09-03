<template>
  <ActionButton
    variant="secondary"
    icon="arrow_back"
    :label="t('common.back')"
    :tooltip="t('common.back')"
    :aria-label="t('common.back')"
    data-cy="back-btn"
    @click="goBack"
  />
</template>

<script setup>
/**
 * ---------------------------------------------------------------------------
 * BackButton — one consistent way out of every detail page.
 * ---------------------------------------------------------------------------
 *
 * Uses the Vue Router history, so returning to a list restores that list's
 * scroll position, filters, search term, sorting and page exactly as the user
 * left them (they live in the list page's own state, which the history entry
 * brings back). When there is no in-app history to go back to — a deep link, a
 * fresh tab, a page opened from an email — it falls back to an explicit route
 * instead of leaving the user stranded or bouncing them out of the app.
 *
 * A loop guard makes sure "back" from a page that was reached via a redirect
 * cannot bounce the user between the same two routes.
 */
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import ActionButton from './ActionButton.vue'

const props = defineProps({
  /** Route to use when there is no history to return to. */
  fallback: { type: [String, Object], default: () => ({ name: 'dashboard' }) },
})

const { t } = useI18n()
const router = useRouter()

function goBack() {
  const canGoBack =
    typeof window !== 'undefined'
    && window.history.length > 1
    // `state.back` is null on the first entry of this tab's history, which is
    // exactly the case where router.back() would leave the application.
    && window.history.state?.back != null

  if (!canGoBack) {
    const target = typeof props.fallback === 'string' ? { name: props.fallback } : props.fallback
    router.replace(target)
    return
  }

  const from = router.currentRoute.value.fullPath
  router.back()

  // If nothing changed shortly after (a blocked or looping navigation), take
  // the fallback rather than leaving the user on the same page.
  setTimeout(() => {
    if (router.currentRoute.value.fullPath === from) {
      const target = typeof props.fallback === 'string' ? { name: props.fallback } : props.fallback
      router.replace(target)
    }
  }, 220)
}
</script>
