/**
 * Shared client-side export helpers — CSV, Excel (SpreadsheetML) and print.
 *
 * Used by the common table action bar so every table page in the app offers
 * the exact same Print / PDF / Excel buttons.
 */

function csvEscape(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Serialize rows (objects) + columns ([{name,label,format?}]) to a CSV string. */
export function toCsv(rows, columns) {
  const cols = columns?.length ? columns : Object.keys(rows[0] || {})
  const headers = cols.map((c) => (typeof c === 'string' ? c : c.label || c.name))
  const lines = [
    headers.map(csvEscape).join(','),
    ...(rows || []).map((r) =>
      cols.map((c) => {
        const key = typeof c === 'string' ? c : c.name
        const value = typeof c !== 'string' && c.format ? c.format(r[key], r) : r[key]
        return csvEscape(value ?? '')
      }).join(',')
    ),
  ]
  return lines.join('\n')
}

function triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
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
 * Excel-compatible file (SpreadsheetML XML). Excel opens `.xls` XML natively
 * with no warning, and it keeps the column order and a bold header row.
 */
export function downloadExcel(filename, rows, columns) {
  const cols = columns?.length ? columns : Object.keys(rows[0] || {})
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const cellsOf = (r, bold) => cols.map((c) => {
    const key = typeof c === 'string' ? c : c.name
    const value = typeof c !== 'string' && c.format ? c.format(r[key], r) : r[key]
    const isNumber = typeof value === 'number' && Number.isFinite(value)
    return `<Cell${bold ? ' ss:StyleID="sHead"' : ''}><Data ss:Type="${isNumber ? 'Number' : 'String'}">${esc(value)}</Data></Cell>`
  }).join('')

  const xml =
    `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Styles><Style ss:ID="sHead"><Font ss:Bold="1"/></Style></Styles>` +
    `<Worksheet ss:Name="Report"><Table>` +
    `<Row>${cellsOf(Object.fromEntries(cols.map((c) => [typeof c === 'string' ? c : c.name, typeof c === 'string' ? c : c.label])), true)}</Row>` +
    (rows || []).map((r) => `<Row>${cellsOf(r)}</Row>`).join('') +
    `</Table></Worksheet></Workbook>`

  triggerDownload(xml, filename.endsWith('.xls') ? filename : `${filename}.xls`, 'application/vnd.ms-excel')
}

/**
 * Print only the element that carries the `print-area` class (the current
 * table + its title). The user can choose "Save as PDF" from the print dialog.
 */
export function printArea(selector = '.print-area') {
  const area = document.querySelector(selector)
  if (!area) return

  const styleId = '__ku_print_style__'
  let style = document.getElementById(styleId)
  if (!style) {
    style = document.createElement('style')
    style.id = styleId
    document.head.appendChild(style)
  }
  style.textContent = `
    body * { visibility: hidden !important; }
    ${selector}, ${selector} * { visibility: visible !important; }
    ${selector} {
      position: absolute !important;
      inset: 0 auto auto 0 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 16px !important;
    }
    ${selector} .q-table { box-shadow: none !important; border: 1px solid #ddd !important; }
    ${selector} .print-hide { display: none !important; }
    @page { size: landscape; margin: 10mm; }
  `
  window.print()
}

/** Today's date as a compact filename stamp (YYYY-MM-DD). */
export function stamp() {
  return new Date().toISOString().slice(0, 10)
}
