/**
 * ---------------------------------------------------------------------------
 * useReportFormat — turn a report payload into localised UI
 * ---------------------------------------------------------------------------
 *
 * The server answers with *data plus label keys* — never with display text —
 * so everything a user reads is produced here, through `t()`. That is what
 * makes the Reports module switch language instantly: the payload never has to
 * be re-fetched, only re-rendered.
 *
 * Responsibilities:
 *   · label / enum-value translation  (`reports.fields.*`, `reports.values.*`)
 *   · locale-aware value formatting   (numbers, currency, dates, Persian and
 *     Arabic-Indic digits — all via `src/utils/format.js`)
 *   · q-table column definitions with RTL-correct alignment
 *   · chart configuration (type auto-selection, RTL axes, themed fonts)
 *   · business insights, expressed as translation keys + parameters
 * ---------------------------------------------------------------------------
 */

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { useLanguage } from 'src/composables/useLanguage'
import { useThemeStore } from 'src/stores/theme'
import { currency, date as formatDate, digits, number as formatNumber, titleCase } from 'src/utils/format'

/** Chart palette — module accents, readable in both light and dark themes. */
const CHART_COLORS = [
  '#2563EB', '#0891B2', '#16A34A', '#7C3AED', '#EA580C',
  '#0D9488', '#DB2777', '#4F46E5', '#D97706', '#059669',
]

export function useReportFormat() {
  const { t, te } = useI18n()
  const { isRtl } = useLanguage()
  const theme = useThemeStore()
  const $q = useQuasar()

  /** Translate a catalog label key, falling back to a readable id. */
  const label = (labelKey, fallback = '') => {
    if (labelKey && te(labelKey)) return t(labelKey)
    return fallback || titleCase(String(labelKey || '').split('.').pop() || '')
  }

  /** Translate an enum cell (`status`, `maintenanceType`, …). */
  const enumLabel = (group, value) => {
    if (value === null || value === undefined || value === '') return t('reports.unspecified')
    const key = `reports.values.${group}.${value}`
    return te(key) ? t(key) : titleCase(String(value))
  }

  /** Format one cell for display, honouring locale, calendar and numerals. */
  function formatValue(value, column = {}) {
    if (value === null || value === undefined || value === '') {
      return column.role === 'metric' ? formatNumber(0) : t('reports.unspecified')
    }
    if (column.translate) return enumLabel(column.translate, value)

    switch (column.type) {
      case 'currency': return currency(value)
      case 'integer': return formatNumber(value, { maximumFractionDigits: 0 })
      case 'number': return formatNumber(value)
      case 'date': return formatDate(value)
      case 'time': return digits(String(value)) // already a bucket key (2026-03, 2026-W12…)
      default: return String(value)
    }
  }

  /** Raw numeric value of a metric cell (for charts and insights). */
  const numericValue = (row, column) => {
    const raw = row?.[column.key]
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }

  /** q-table columns from the payload's column descriptors. */
  function tableColumns(columns = []) {
    return columns.map((col) => ({
      name: col.key,
      field: col.key,
      label: label(col.labelKey, col.id),
      align: col.role === 'metric' || ['currency', 'number', 'integer'].includes(col.type)
        ? (isRtl.value ? 'left' : 'right')
        : (isRtl.value ? 'right' : 'left'),
      sortable: true,
      classes: col.role === 'metric' ? 'app-numeric' : '',
      format: (val) => formatValue(val, col),
      // Keep the raw value for sorting so "۱۰" never sorts as text.
      sort: (a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a ?? '').localeCompare(String(b ?? '')),
      meta: col,
    }))
  }

  /** Which chart suits this shape of data best. */
  function autoChartType(result) {
    if (!result || result.meta?.mode === 'detail') return 'table'
    const dims = result.columns.filter((c) => c.role === 'dimension')
    const metrics = result.columns.filter((c) => c.role === 'metric')
    if (!dims.length || !metrics.length) return 'table'

    const first = dims[0]
    if (first.type === 'time') return result.rows.length > 12 ? 'area' : 'line'
    if (metrics.length === 1 && result.rows.length <= 6) return 'donut'
    if (result.rows.length > 12) return 'bar' // horizontal — long category names stay readable
    return 'column'
  }

  /**
   * ApexCharts configuration. Titles, legends, axis labels and tooltips all go
   * through `t()` / `formatValue()`, so a locale switch re-renders the chart
   * with translated text, mirrored axes and localised digits.
   */
  function chartConfig(result, requestedType = 'auto') {
    if (!result?.rows?.length) return null
    const type = requestedType === 'auto' || !requestedType ? autoChartType(result) : requestedType
    if (type === 'table') return null

    const dims = result.columns.filter((c) => c.role === 'dimension')
    const metrics = result.columns.filter((c) => c.role === 'metric')
    if (!dims.length || !metrics.length) return null

    const dim = dims[0]
    const rows = [...result.rows].slice(0, 24)
    const categories = rows.map((row) => {
      const value = row[dim.key]
      return dim.translate ? enumLabel(dim.translate, value) : (value === null || value === '' ? t('reports.unspecified') : String(value))
    })

    const circular = type === 'pie' || type === 'donut'
    const apexType = type === 'column' ? 'bar' : type
    const horizontal = type === 'bar'

    const fontFamily = theme.activeFontStack
    const foreColor = $q.dark.isActive ? '#C7CBD3' : '#475467'

    if (circular) {
      const metric = metrics[0]
      return {
        type: apexType,
        height: 320,
        series: rows.map((row) => numericValue(row, metric)),
        options: {
          chart: { type: apexType, fontFamily, foreColor, toolbar: { show: false }, animations: { enabled: theme.settings.animation !== false, speed: 260 } },
          labels: categories,
          colors: CHART_COLORS,
          legend: { position: 'bottom', horizontalAlign: 'center', fontFamily },
          dataLabels: { enabled: true, formatter: (val) => digits(`${Math.round(val)}%`), style: { fontFamily } },
          tooltip: { y: { formatter: (val) => formatValue(val, metric), title: { formatter: () => label(metric.labelKey, metric.id) } }, style: { fontFamily } },
          stroke: { width: 2, colors: [$q.dark.isActive ? '#1B1E24' : '#FFFFFF'] },
          plotOptions: { pie: { donut: { size: type === 'donut' ? '62%' : '0%' } } },
          noData: { text: t('reports.charts.noData'), style: { fontFamily } },
        },
      }
    }

    return {
      type: apexType,
      height: 340,
      series: metrics.map((metric) => ({
        name: label(metric.labelKey, metric.id),
        data: rows.map((row) => numericValue(row, metric)),
      })),
      options: {
        chart: {
          type: apexType,
          fontFamily,
          foreColor,
          toolbar: { show: false },
          zoom: { enabled: false },
          animations: { enabled: theme.settings.animation !== false, speed: 260 },
          stacked: false,
        },
        colors: CHART_COLORS,
        plotOptions: { bar: { horizontal, borderRadius: 4, columnWidth: '55%', dataLabels: { position: 'top' } } },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: apexType === 'line' ? 3 : apexType === 'area' ? 2 : 0 },
        fill: apexType === 'area' ? { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.05 } } : { opacity: 1 },
        grid: { borderColor: $q.dark.isActive ? '#2A2F38' : '#EAECF0', strokeDashArray: 4 },
        xaxis: {
          categories,
          labels: { style: { fontFamily }, formatter: (val) => digits(String(val ?? '')), trim: true, hideOverlappingLabels: true },
          title: { text: label(dim.labelKey, dim.id), style: { fontFamily, fontWeight: 600 } },
        },
        yaxis: {
          // Mirror the value axis for right-to-left languages.
          opposite: isRtl.value,
          labels: { style: { fontFamily }, formatter: (val) => formatNumber(val, { maximumFractionDigits: 0 }) },
        },
        legend: { position: 'top', horizontalAlign: isRtl.value ? 'right' : 'left', fontFamily, showForSingleSeries: metrics.length > 1 },
        tooltip: {
          shared: true,
          intersect: false,
          style: { fontFamily },
          y: { formatter: (val, opts) => formatValue(val, metrics[opts?.seriesIndex ?? 0] || metrics[0]) },
        },
        noData: { text: t('reports.charts.noData'), style: { fontFamily } },
      },
    }
  }

  /**
   * Business insights — returned as `{ icon, text }` where the text is already
   * translated with its parameters, so the list re-renders on a locale switch.
   */
  function insights(result) {
    if (!result?.rows?.length) return []
    const out = []
    const dims = result.columns.filter((c) => c.role === 'dimension')
    const metrics = result.columns.filter((c) => c.role === 'metric')

    if (dims.length && metrics.length) {
      const dim = dims[0]
      const metric = metrics[0]
      const named = result.rows.map((row) => ({
        name: dim.translate
          ? enumLabel(dim.translate, row[dim.key])
          : (row[dim.key] === null || row[dim.key] === '' ? t('reports.unspecified') : String(row[dim.key])),
        value: numericValue(row, metric),
      }))
      const total = named.reduce((sum, item) => sum + item.value, 0)
      const sorted = [...named].sort((a, b) => b.value - a.value)
      const share = (value) => digits(total > 0 ? `${Math.round((value / total) * 100)}%` : '0%')

      if (sorted[0]) {
        out.push({
          icon: 'emoji_events',
          tone: 'success',
          text: t('reports.insights.top', {
            name: sorted[0].name,
            value: formatValue(sorted[0].value, metric),
            share: share(sorted[0].value),
          }),
        })
      }
      if (sorted.length > 2) {
        const topThree = sorted.slice(0, 3).reduce((sum, item) => sum + item.value, 0)
        const ratio = total > 0 ? topThree / total : 0
        out.push(
          ratio >= 0.6
            ? { icon: 'donut_small', tone: 'info', text: t('reports.insights.concentration', { share: share(topThree) }) }
            : { icon: 'equalizer', tone: 'info', text: t('reports.insights.spread') },
        )
      }
      if (sorted.length > 1) {
        const last = sorted[sorted.length - 1]
        out.push({ icon: 'trending_down', tone: 'warning', text: t('reports.insights.bottom', { name: last.name, value: formatValue(last.value, metric) }) })
      }

      // Trend: first vs last bucket of a time series.
      if (dim.type === 'time' && result.rows.length > 1) {
        const first = numericValue(result.rows[0], metric)
        const latest = numericValue(result.rows[result.rows.length - 1], metric)
        if (first > 0) {
          const delta = Math.round(((latest - first) / first) * 100)
          if (delta !== 0) {
            out.push({
              icon: delta > 0 ? 'trending_up' : 'trending_down',
              tone: delta > 0 ? 'success' : 'danger',
              text: t(delta > 0 ? 'reports.insights.growth' : 'reports.insights.decline', {
                metric: label(metric.labelKey, metric.id),
                value: digits(`${Math.abs(delta)}%`),
              }),
            })
          }
        }
      }

      if (named.length > 1) {
        out.push({
          icon: 'functions',
          tone: 'neutral',
          text: t('reports.insights.average', { count: digits(named.length), value: formatValue(total / named.length, metric) }),
        })
      }
    } else {
      out.push({ icon: 'table_rows', tone: 'neutral', text: t('reports.insights.rowCount', { count: digits(result.rows.length) }) })
    }

    return out.slice(0, 5)
  }

  /** Export-ready rows: display strings, so Excel/PDF match what is on screen. */
  function exportRows(result) {
    return (result?.rows || []).map((row) => {
      const out = {}
      for (const col of result.columns) out[col.key] = formatValue(row[col.key], col)
      return out
    })
  }

  const exportColumns = (result) => (result?.columns || []).map((col) => ({
    name: col.key,
    label: label(col.labelKey, col.id),
    field: col.key,
  }))

  const periodLabel = (preset) => {
    const key = `reports.periods.${String(preset || 'all_time').replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())}`
    return te(key) ? t(key) : String(preset)
  }

  return {
    label,
    enumLabel,
    formatValue,
    tableColumns,
    chartConfig,
    autoChartType,
    insights,
    exportRows,
    exportColumns,
    periodLabel,
    isRtl,
    chartColors: computed(() => CHART_COLORS),
  }
}

export default useReportFormat
