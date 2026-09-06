<template>
  <div class="saved-panel">
    <!-- ------------------------------------------------------ saved list -->
    <section class="app-card">
      <header class="app-card__header">
        <div>
          <h3 class="app-card__title">
            <q-icon name="bookmarks" size="20px" /> {{ t('reports.saved.title') }}
          </h3>
          <p class="app-card__hint">{{ t('reports.saved.hint') }}</p>
        </div>
        <ActionButton
          intent="secondary"
          icon="refresh"
          :label="t('reports.actions.refresh')"
          :loading="busy"
          @click="$emit('refresh')"
        />
      </header>

      <div class="app-card__body">
        <div v-if="!reports.length" class="saved-panel__empty">
          <q-icon name="bookmark_border" size="34px" />
          <p class="app-body">{{ t('reports.saved.empty') }}</p>
          <p class="app-hint">{{ t('reports.saved.emptyHint') }}</p>
        </div>

        <ul v-else class="saved-panel__list">
          <li v-for="report in reports" :key="report.id" class="saved-panel__item">
            <div class="saved-panel__info">
              <div class="saved-panel__title-row">
                <span class="app-card-title">{{ report.name }}</span>
                <span :class="['app-badge', report.is_shared ? 'app-badge--success' : 'app-badge--neutral']">
                  {{ report.is_shared ? t('reports.saved.shared') : t('reports.saved.private') }}
                </span>
                <span class="app-badge app-badge--info">{{ moduleLabel(report.module) }}</span>
              </div>
              <p v-if="report.description" class="app-small saved-panel__desc">{{ report.description }}</p>
              <p v-if="report.question" class="app-hint saved-panel__question">
                <q-icon name="format_quote" size="14px" /> {{ report.question }}
              </p>
              <p class="app-hint saved-panel__meta">
                <span>{{ t('reports.saved.createdBy') }}: {{ report.created_by_name || '—' }}</span>
                <span>· {{ t('reports.saved.createdAt') }}: {{ formatDate(report.created_at) }}</span>
                <span v-if="report.last_run_at">· {{ t('reports.saved.lastRun') }}: {{ timeAgo(report.last_run_at) }}</span>
                <span>· {{ t('reports.saved.runCount') }}: {{ digits(report.run_count || 0) }}</span>
              </p>
            </div>

            <div class="saved-panel__actions">
              <ActionButton
                intent="view"
                icon="play_arrow"
                :label="t('reports.actions.run')"
                :loading="runningId === report.id"
                @click="$emit('run', report)"
              />
              <ActionButton
                intent="edit"
                icon="edit"
                icon-only
                :tooltip="t('reports.actions.edit')"
                :aria-label="t('reports.actions.edit')"
                @click="$emit('edit', report)"
              />
              <ActionButton
                intent="secondary"
                icon="content_copy"
                icon-only
                :tooltip="t('reports.actions.duplicate')"
                :aria-label="t('reports.actions.duplicate')"
                @click="$emit('duplicate', report)"
              />
              <ActionButton
                v-if="canSchedule"
                intent="info"
                icon="schedule_send"
                icon-only
                :tooltip="t('reports.actions.schedule')"
                :aria-label="t('reports.actions.schedule')"
                @click="$emit('schedule', report)"
              />
              <ActionButton
                intent="secondary"
                icon="share"
                icon-only
                :tooltip="t('reports.actions.share')"
                :aria-label="t('reports.actions.share')"
                @click="$emit('share', report)"
              />
              <ActionButton
                intent="delete"
                icon="delete"
                icon-only
                :tooltip="t('reports.actions.delete')"
                :aria-label="t('reports.actions.delete')"
                @click="$emit('remove', report)"
              />
            </div>
          </li>
        </ul>
      </div>
    </section>

    <!-- ------------------------------------------------------- schedules -->
    <section v-if="canSchedule" class="app-card">
      <header class="app-card__header">
        <div>
          <h3 class="app-card__title">
            <q-icon name="event_repeat" size="20px" /> {{ t('reports.schedule.title') }}
          </h3>
          <p class="app-card__hint">{{ t('reports.schedule.hint') }}</p>
        </div>
        <ActionButton
          intent="info"
          icon="add_alarm"
          :label="t('reports.schedule.create')"
          :disable="!reports.length"
          @click="$emit('schedule', null)"
        />
      </header>

      <div class="app-card__body">
        <div v-if="!schedules.length" class="saved-panel__empty">
          <q-icon name="event_busy" size="34px" />
          <p class="app-body">{{ t('reports.schedule.empty') }}</p>
          <p class="app-hint">{{ t('reports.schedule.emptyHint') }}</p>
        </div>

        <ul v-else class="saved-panel__list">
          <li v-for="item in schedules" :key="item.id" class="saved-panel__item">
            <div class="saved-panel__info">
              <div class="saved-panel__title-row">
                <span class="app-card-title">{{ item.report_name }}</span>
                <span :class="['app-badge', item.active ? 'app-badge--success' : 'app-badge--neutral']">
                  {{ item.active ? t('reports.schedule.active') : t('reports.schedule.paused') }}
                </span>
                <span class="app-badge app-badge--info">{{ t(`reports.schedule.${item.frequency}`) }}</span>
                <span class="app-badge app-badge--view">{{ deliveryLabel(item.delivery) }}</span>
              </div>
              <p class="app-hint saved-panel__meta">
                <span>{{ t('reports.schedule.time') }}: {{ digits(item.time_of_day) }}</span>
                <span v-if="item.frequency === 'weekly' && item.day_of_week !== null">
                  · {{ t(`reports.schedule.days.${item.day_of_week}`) }}
                </span>
                <span v-if="item.next_run_at">· {{ t('reports.schedule.nextRun') }}: {{ formatDate(item.next_run_at, true) }}</span>
                <span>· {{ t('reports.schedule.format') }}: {{ formatLabel(item.format) }}</span>
                <span v-if="item.recipients">· {{ t('reports.schedule.recipients') }}: {{ item.recipients }}</span>
              </p>
            </div>

            <div class="saved-panel__actions">
              <ActionButton
                :intent="item.active ? 'warning' : 'success'"
                :icon="item.active ? 'pause' : 'play_arrow'"
                icon-only
                :tooltip="item.active ? t('reports.schedule.paused') : t('reports.schedule.active')"
                :aria-label="item.active ? t('reports.schedule.paused') : t('reports.schedule.active')"
                @click="$emit('toggle-schedule', item)"
              />
              <ActionButton
                intent="edit"
                icon="edit"
                icon-only
                :tooltip="t('reports.actions.edit')"
                :aria-label="t('reports.actions.edit')"
                @click="$emit('edit-schedule', item)"
              />
              <ActionButton
                intent="delete"
                icon="delete"
                icon-only
                :tooltip="t('reports.actions.delete')"
                :aria-label="t('reports.actions.delete')"
                @click="$emit('remove-schedule', item)"
              />
            </div>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup>
/**
 * Saved reports and their delivery schedules.
 *
 * A saved report stores the *normalised* Report Query Object, so re-running it
 * goes through exactly the same validation and permission checks as a fresh
 * question — a report saved last year can never widen someone's access today.
 */
import { useI18n } from 'vue-i18n'
import ActionButton from 'src/components/common/ActionButton.vue'
import { useReportFormat } from 'src/composables/useReportFormat'
import { date as formatDate, digits, timeAgo } from 'src/utils/format'

const props = defineProps({
  reports: { type: Array, default: () => [] },
  schedules: { type: Array, default: () => [] },
  catalog: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  runningId: { type: [Number, String], default: null },
  canSchedule: { type: Boolean, default: false },
})
defineEmits([
  'refresh', 'run', 'edit', 'duplicate', 'remove', 'share',
  'schedule', 'edit-schedule', 'remove-schedule', 'toggle-schedule',
])

const { t } = useI18n()
const { label } = useReportFormat()

const moduleLabel = (id) => {
  const mod = (props.catalog?.modules || []).find((m) => m.id === id)
  return label(mod?.labelKey, id)
}

const deliveryLabel = (delivery) => t(`reports.schedule.${delivery === 'download' ? 'downloadCenter' : delivery}`)
const formatLabel = (format) => t(`reports.actions.export${format.charAt(0).toUpperCase()}${format.slice(1)}`)
</script>

<style scoped>
.saved-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.saved-panel__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.saved-panel__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--app-border, #E4E7EC);
  border-radius: var(--app-radius, 10px);
  background: var(--app-surface, #FFF);
}

.saved-panel__info {
  flex: 1 1 320px;
  min-inline-size: 0;
}

.saved-panel__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.saved-panel__desc,
.saved-panel__question {
  margin: 4px 0 0;
}

.saved-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 0;
}

.saved-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.saved-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 16px;
  color: var(--app-text-muted, #667085);
}

.saved-panel__empty p { margin: 0; }
</style>
