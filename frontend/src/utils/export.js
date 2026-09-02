/**
 * Shared client-side export helpers — CSV, Excel (.xlsx), PDF and print.
 *
 * Used by the common table action bar so every table page in the app offers
 * the exact same Print / PDF / Excel buttons.
 *
 * Heavy libraries (SheetJS, jsPDF) are loaded lazily via dynamic import so
 * they never weigh down the initial application bundle.
 */

const SYSTEM_NAME = 'Kabul University Asset Management System (KU-AMS)'

function csvEscape(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Normalize columns to `{ name, label, format? }`, dropping UI-only columns. */
function normalizeColumns(columns, rows) {
  const cols = columns?.length ? columns : Object.keys(rows?.[0] || {})
  return cols
    .map((c) => (typeof c === 'string' ? { name: c, label: c } : { name: c.name, label: c.label || c.name, format: c.format, field: c.field }))
    .filter((c) => !['actions', 'select', 'no'].includes(c.name))
}

/** Resolve a single cell value, honoring q-table `field` and `format`. */
function cellValue(col, row) {
  let value
  if (typeof col.field === 'function') value = col.field(row)
  else if (col.field && typeof col.field === 'string') value = row[col.field]
  else value = row[col.name]
  if (col.format) value = col.format(value, row)
  return value ?? ''
}

/** Serialize rows (objects) + columns ([{name,label,format?}]) to a CSV string. */
export function toCsv(rows, columns) {
  const cols = normalizeColumns(columns, rows)
  const lines = [
    cols.map((c) => csvEscape(c.label)).join(','),
    ...(rows || []).map((r) => cols.map((c) => csvEscape(cellValue(c, r))).join(',')),
  ]
  return lines.join('\n')
}

function triggerDownload(content, filename, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(href), 4000)
}

export function downloadCsv(filename, rows, columns) {
  // UTF-8 BOM so Excel opens Persian/Arabic text correctly.
  triggerDownload('\uFEFF' + toCsv(rows, columns), filename.endsWith('.csv') ? filename : `${filename}.csv`, 'text/csv;charset=utf-8')
}

/**
 * Real `.xlsx` workbook (SheetJS). Column order is preserved, the header row
 * carries the translated labels, and column widths are auto-fitted to the
 * longest value so the sheet opens clean in Excel / LibreOffice.
 */
export async function downloadExcel(filename, rows, columns, { sheetName = 'Report' } = {}) {
  const XLSX = await import('xlsx')
  const cols = normalizeColumns(columns, rows)

  const header = cols.map((c) => String(c.label))
  const body = (rows || []).map((r) => cols.map((c) => {
    const v = cellValue(c, r)
    return typeof v === 'number' && Number.isFinite(v) ? v : String(v)
  }))

  const ws = XLSX.utils.aoa_to_sheet([header, ...body])
  // Auto-fit column widths (capped so one long note cannot explode a column).
  ws['!cols'] = cols.map((c, i) => ({
    wch: Math.min(48, Math.max(header[i].length, ...body.map((row) => String(row[i]).length), 8) + 2),
  }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length, c: cols.length - 1 } }) }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

/**
 * Professional PDF export (jsPDF + AutoTable): report title, system name,
 * generation timestamp, striped table with repeated headers and
 * "Page X of Y" footers. Handles large datasets via automatic pagination.
 */
export async function downloadPdf(filename, rows, columns, { title = 'Report' } = {}) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableModule.default || autoTableModule.autoTable

  const cols = normalizeColumns(columns, rows)
  const head = [cols.map((c) => String(c.label))]
  const body = (rows || []).map((r) => cols.map((c) => String(cellValue(c, r))))

  const doc = new jsPDF({ orientation: cols.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16)

  autoTable(doc, {
    head,
    body,
    startY: 86,
    margin: { top: 86, left: 40, right: 40, bottom: 46 },
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [27, 94, 32], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 248, 244] },
    rowPageBreak: 'avoid',
    didDrawPage: () => {
      // Header band
      doc.setFontSize(15)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(27, 94, 32)
      doc.text(String(title), 40, 44)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(90)
      doc.text(SYSTEM_NAME, 40, 60)
      doc.text(`Generated: ${generatedAt}`, 40, 73)
      doc.setDrawColor(27, 94, 32)
      doc.setLineWidth(1)
      doc.line(40, 79, pageWidth - 40, 79)
    },
  })

  // "Page X of Y" footers (added after the table so Y is known).
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 24, { align: 'center' })
    doc.text(SYSTEM_NAME, 40, doc.internal.pageSize.getHeight() - 24)
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

/**
 * Print only the element that carries the `print-area` class (the current
 * table + its title) with a clean report layout: navigation, sidebars and
 * action buttons are hidden, table headers repeat on every printed page and
 * rows never split across a page break.
 */
export function printArea(selector = '.print-area', { title = '' } = {}) {
  const area = document.querySelector(selector)
  if (!area) throw new Error('Nothing to print on this page.')

  // Temporary print-only header (title + system name + date).
  const headerId = '__ku_print_header__'
  document.getElementById(headerId)?.remove()
  const header = document.createElement('div')
  header.id = headerId
  header.className = 'ku-print-header'
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16)
  header.innerHTML = `
    <div class="ku-print-header__title"></div>
    <div class="ku-print-header__meta"></div>
  `
  header.querySelector('.ku-print-header__title').textContent = title || document.title
  header.querySelector('.ku-print-header__meta').textContent = `${SYSTEM_NAME} — ${generatedAt}`
  area.prepend(header)

  const styleId = '__ku_print_style__'
  let style = document.getElementById(styleId)
  if (!style) {
    style = document.createElement('style')
    style.id = styleId
    document.head.appendChild(style)
  }
  style.textContent = `
    .ku-print-header { display: none; }
    @media print {
      body * { visibility: hidden !important; }
      ${selector}, ${selector} * { visibility: visible !important; }
      ${selector} {
        position: absolute !important;
        inset: 0 auto auto 0 !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 12px !important;
        background: #fff !important;
      }
      ${selector} .q-table { box-shadow: none !important; border: 1px solid #ddd !important; }
      ${selector} .q-table__container { max-height: none !important; }
      ${selector} .print-hide, ${selector} .q-btn, ${selector} .q-pagination { display: none !important; }
      ${selector} .ku-print-header { display: block !important; margin-bottom: 10px; border-bottom: 2px solid #C8862D; padding-bottom: 6px; }
      ${selector} .ku-print-header__title { font-size: 17px; font-weight: 700; color: #123A66; }
      ${selector} .ku-print-header__meta { font-size: 10px; color: #666; margin-top: 2px; }
      /* Keep tables tidy across page breaks. */
      ${selector} table { page-break-inside: auto !important; border-collapse: collapse !important; }
      ${selector} thead { display: table-header-group !important; }
      ${selector} tr { page-break-inside: avoid !important; }
      ${selector} th, ${selector} td { color: #000 !important; }
    }
    @page { size: landscape; margin: 10mm; }
  `

  const cleanup = () => {
    header.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
  // Fallback for browsers that never fire afterprint.
  setTimeout(cleanup, 2000)
}

/** Today's date as a compact filename stamp (YYYY-MM-DD). */
export function stamp() {
  return new Date().toISOString().slice(0, 10)
}

/** Build a clean, professional export filename: `Assets_Report_2026-09-02`. */
export function exportFilename(base) {
  const clean = String(base || 'Report')
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
  return `${clean}_${stamp()}`
}
