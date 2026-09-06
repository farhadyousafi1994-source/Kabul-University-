<template>
  <div class="ask-panel">
    <!-- ------------------------------------------------------------- ask -->
    <section class="app-card app-card--accent app-accent-indigo ask-panel__box">
      <div class="app-card__body">
        <h2 class="app-section-title ask-panel__heading">
          <q-icon name="auto_awesome" size="22px" class="ask-panel__spark" />
          {{ t('reports.ask.heading') }}
        </h2>
        <p class="app-hint ask-panel__hint">{{ t('reports.ask.hint') }}</p>

        <q-input
          v-model="question"
          type="textarea"
          outlined
          autogrow
          input-class="ask-panel__input"
          :placeholder="t('reports.ask.placeholder')"
          :disable="busy"
          :aria-label="t('reports.ask.heading')"
          class="ask-panel__field"
          @keydown.ctrl.enter.prevent="submit"
          @keydown.meta.enter.prevent="submit"
        >
          <template #prepend>
            <q-icon name="chat_bubble_outline" />
          </template>
        </q-input>

        <div class="ask-panel__actions">
          <ActionButton
            intent="submit"
            icon="auto_awesome"
            :label="t('reports.ask.generate')"
            :loading="busy"
            :disable="!question.trim()"
            hide-label-on="none"
            data-cy="ask-generate"
            @click="submit"
          />
          <ActionButton
            intent="cancel"
            icon="close"
            :label="t('reports.ask.clear')"
            :disable="busy || !question"
            @click="clearQuestion"
          />
          <!-- Placeholder for future speech-to-text input. -->
          <ActionButton
            intent="ghost"
            icon="mic_none"
            :tooltip="t('reports.ask.voice')"
            :aria-label="t('reports.ask.voice')"
            icon-only
            disable
          />
          <q-space />
          <div class="ask-panel__badges">
            <span class="app-badge app-badge--success">
              <q-icon name="lock" size="14px" /> {{ t('reports.security.readOnly') }}
            </span>
            <span class="app-badge app-badge--info">
              <q-icon name="verified_user" size="14px" /> {{ t('reports.security.permissionFiltered') }}
            </span>
          </div>
        </div>

        <p v-if="busy" class="app-small ask-panel__status">
          <q-spinner-dots size="18px" /> {{ t('reports.ask.analysing') }}
        </p>
      </div>
    </section>

    <!-- ------------------------------------------------------- suggestions -->
    <div class="ask-panel__columns">
      <section class="app-card">
        <header class="app-card__header">
          <h3 class="app-card__title">
            <q-icon name="lightbulb" size="18px" /> {{ t('reports.ask.suggestions') }}
          </h3>
        </header>
        <div class="app-card__body ask-panel__chips">
          <button
            v-for="key in suggestionKeys"
            :key="key"
            type="button"
            class="ask-chip"
            :disabled="busy"
            @click="use(t(key))"
          >
            <q-icon name="north_east" size="15px" />
            <span>{{ t(key) }}</span>
          </button>
        </div>
      </section>

      <!-- ---------------------------------------------------------- recent -->
      <section class="app-card">
        <header class="app-card__header">
          <h3 class="app-card__title">
            <q-icon name="history" size="18px" /> {{ t('reports.ask.recent') }}
          </h3>
          <ActionButton
            v-if="recent.length"
            intent="ghost"
            icon="delete_sweep"
            :tooltip="t('reports.ask.clearHistory')"
            :aria-label="t('reports.ask.clearHistory')"
            icon-only
            @click="$emit('clear-history')"
          />
        </header>
        <div class="app-card__body ask-panel__chips">
          <p v-if="!recent.length" class="app-hint">{{ t('reports.ask.recentEmpty') }}</p>
          <button
            v-for="(entry, index) in recent"
            :key="`${entry.question}-${index}`"
            type="button"
            class="ask-chip ask-chip--history"
            :disabled="busy"
            @click="use(entry.question)"
          >
            <q-icon name="replay" size="15px" />
            <span class="ask-chip__text">{{ entry.question }}</span>
            <span class="app-hint ask-chip__meta">{{ timeAgo(entry.at) }}</span>
          </button>
        </div>
      </section>
    </div>

    <p class="app-small ask-panel__security">
      <q-icon name="shield" size="16px" /> {{ t('reports.security.note') }}
    </p>
  </div>
</template>

<script setup>
/**
 * "Ask your data" — the natural-language entry point of the report generator.
 *
 * The component only collects the question; understanding happens in
 * `src/utils/reportNlu.js` and execution on the server. Every string here is a
 * translation key, so the panel works identically in English, Farsi, Dari,
 * Pashto and Arabic — including the suggested questions, which are authored
 * per language rather than translated at runtime.
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionButton from 'src/components/common/ActionButton.vue'
import { SUGGESTION_KEYS } from 'src/config/reportKeywords'
import { timeAgo } from 'src/utils/format'

const props = defineProps({
  modelValue: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  recent: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'ask', 'clear-history'])

const { t } = useI18n()
const suggestionKeys = SUGGESTION_KEYS
const question = ref(props.modelValue)

watch(() => props.modelValue, (value) => { if (value !== question.value) question.value = value })
watch(question, (value) => emit('update:modelValue', value))

function submit() {
  const text = question.value.trim()
  if (!text || props.busy) return
  emit('ask', text)
}

function use(text) {
  question.value = text
  emit('ask', text)
}

function clearQuestion() {
  question.value = ''
}
</script>

<style scoped>
.ask-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ask-panel__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.ask-panel__spark { color: var(--app-accent, #4F46E5); }

.ask-panel__hint {
  margin: 4px 0 14px;
  max-width: 70ch;
}

.ask-panel__field :deep(.ask-panel__input) {
  min-height: 76px;
  font-size: 1.05rem;
  line-height: 1.6;
}

.ask-panel__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.ask-panel__badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ask-panel__status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0 0;
}

.ask-panel__columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.ask-panel__chips {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ask-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  inline-size: 100%;
  padding-block: 9px;
  padding-inline: 12px;
  border: 1px solid var(--app-border, #E4E7EC);
  border-radius: var(--app-radius, 10px);
  background: var(--app-surface, #FFF);
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
}

.ask-chip:hover:not(:disabled) {
  background: var(--app-surface-hover, rgba(37, 99, 235, 0.06));
  border-color: var(--app-accent, #2563EB);
  transform: translateY(-1px);
}

.ask-chip:disabled { opacity: 0.6; cursor: not-allowed; }
.ask-chip:focus-visible { outline: 2px solid var(--app-accent, #2563EB); outline-offset: 2px; }

.ask-chip__text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ask-chip__meta { white-space: nowrap; }

.ask-panel__security {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--app-text-muted, #667085);
}

.app-no-anim .ask-chip { transition: none; }
</style>
