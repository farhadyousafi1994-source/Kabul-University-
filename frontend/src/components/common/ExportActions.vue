<template>
  <div class="export-actions">
    <ActionButton
      variant="secondary"
      icon="print"
      :label="t('common.print')"
      :tooltip="t('common.printTooltip')"
      :loading="printing"
      :disable="isEmpty || busy"
      @click="doPrint"
    />
    <ActionButton
      variant="secondary"
      icon="picture_as_pdf"
      :label="t('common.pdf')"
      :tooltip="t('common.pdfTooltip')"
      :loading="pdfing"
      :disable="isEmpty || busy"
      @click="doPdf"
    />
    <ActionButton
      variant="secondary"
      icon="table_view"
      :label="t('common.excel')"
      :tooltip="t('common.excelTooltip')"
      :loading="exceling"
      :disable="isEmpty || busy"
      @click="doExcel"
    />
  </div>
</template>

<script setup>
/**
 * Print / PDF / Excel for the current table view, as three enterprise buttons
 * (the old circular icon buttons are gone). Each one owns its loading state and
 * is disabled while any export is running, so a double click can never start
 * two downloads of the same report.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionButton from './ActionButton.vue'
import { downloadExcel, downloadPdf, exportFilename, printArea } from 'src/utils/export'
import { notify } from 'src/utils/notify'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  filename: { type: String, default: 'Report' },
  title: { type: String, default: '' },
  printSelector: { type: String, default: '.print-area' },
})

const { t } = useI18n()

const printing = ref(false)
const pdfing = ref(false)
const exceling = ref(false)
const busy = computed(() => printing.value || pdfing.value || exceling.value)
const isEmpty = computed(() => !props.rows?.length)

const reportTitle = computed(() => props.title || props.filename)
const baseFilename = computed(() => exportFilename(props.filename))

const exportColumns = () => (props.columns || []).filter((c) => c.name !== 'actions' && c.name !== 'select')

function doPrint() {
  if (busy.value) return
  printing.value = true
  try {
    printArea(props.printSelector, { title: reportTitle.value })
  } catch (e) {
    notify.error(e.message || t('common.exportFailed'))
  } finally {
    printing.value = false
  }
}

async function doPdf() {
  if (busy.value) return
  pdfing.value = true
  try {
    const cols = exportColumns()
    await downloadPdf(baseFilename.value, props.rows, cols.length ? cols : null, { title: reportTitle.value })
    notify.success(t('common.pdfExported'))
  } catch (e) {
    notify.error(e.message || t('common.exportFailed'))
  } finally {
    pdfing.value = false
  }
}

async function doExcel() {
  if (busy.value) return
  exceling.value = true
  try {
    const cols = exportColumns()
    await downloadExcel(baseFilename.value, props.rows, cols.length ? cols : null, { sheetName: reportTitle.value })
    notify.success(t('common.excelExported'))
  } catch (e) {
    notify.error(e.message || t('common.exportFailed'))
  } finally {
    exceling.value = false
  }
}
</script>

<style lang="sass" scoped>
.export-actions
  display: flex
  align-items: center
  gap: 8px
  flex-wrap: wrap
</style>
