/**
 * ---------------------------------------------------------------------------
 * Action design system — meaning first, colour second.
 * ---------------------------------------------------------------------------
 *
 * Every clickable action in the ERP declares an INTENT ("excel", "edit",
 * "delete", …). The intent decides the colour, the default icon and the
 * emphasis, so the rule "Export to Excel is always green with a spreadsheet
 * icon" is enforced by the design system instead of by convention.
 *
 * Colours are never written here as raw hex: each intent points at a CSS
 * custom property published by the theme store (`--app-action-*`), which is
 * itself mode-aware (light / dark). Components therefore stay theme-agnostic.
 *
 *   <ActionButton intent="excel" />          → green, spreadsheet icon
 *   <ActionButton intent="delete" />         → red, trash icon
 *   <ActionButton intent="save" />           → brand primary
 */

/**
 * intent → { token, icon, emphasis }
 *   token     CSS variable suffix: var(--app-action-<token>)
 *   icon      default Material/MDI icon when the caller does not pass one
 *   emphasis  'solid' (filled) | 'soft' (tinted) | 'quiet' (outlined/neutral)
 */
export const ACTION_INTENTS = {
  primary: { token: 'primary', icon: '', emphasis: 'solid' },
  save: { token: 'primary', icon: 'save', emphasis: 'solid' },
  create: { token: 'primary', icon: 'add', emphasis: 'solid' },
  add: { token: 'primary', icon: 'add', emphasis: 'solid' },
  submit: { token: 'primary', icon: 'check', emphasis: 'solid' },
  success: { token: 'success', icon: 'check_circle', emphasis: 'solid' },
  approve: { token: 'success', icon: 'task_alt', emphasis: 'solid' },
  excel: { token: 'excel', icon: 'mdi-microsoft-excel', emphasis: 'solid' },
  export: { token: 'excel', icon: 'mdi-file-excel', emphasis: 'solid' },
  import: { token: 'info', icon: 'upload_file', emphasis: 'soft' },
  pdf: { token: 'pdf', icon: 'picture_as_pdf', emphasis: 'soft' },
  print: { token: 'print', icon: 'print', emphasis: 'quiet' },
  edit: { token: 'edit', icon: 'edit', emphasis: 'soft' },
  view: { token: 'view', icon: 'visibility', emphasis: 'soft' },
  details: { token: 'view', icon: 'open_in_new', emphasis: 'soft' },
  info: { token: 'info', icon: 'info', emphasis: 'soft' },
  warning: { token: 'warning', icon: 'warning_amber', emphasis: 'solid' },
  danger: { token: 'danger', icon: 'delete', emphasis: 'solid' },
  delete: { token: 'danger', icon: 'delete', emphasis: 'solid' },
  archive: { token: 'danger', icon: 'archive', emphasis: 'soft' },
  reject: { token: 'danger', icon: 'cancel', emphasis: 'soft' },
  cancel: { token: 'cancel', icon: '', emphasis: 'quiet' },
  neutral: { token: 'neutral', icon: '', emphasis: 'quiet' },
  secondary: { token: 'neutral', icon: '', emphasis: 'quiet' },
  refresh: { token: 'neutral', icon: 'refresh', emphasis: 'quiet' },
  ghost: { token: 'neutral', icon: '', emphasis: 'ghost' },
}

export const DEFAULT_INTENT = 'secondary'

/** Legacy `variant` / Quasar `color` values → intent. */
const ALIASES = {
  // legacy ActionButton variants
  danger: 'danger',
  ghost: 'ghost',
  secondary: 'secondary',
  primary: 'primary',
  // Quasar palette names still passed by older call sites
  negative: 'danger',
  positive: 'success',
  green: 'success',
  red: 'danger',
  blue: 'edit',
  cyan: 'view',
  orange: 'warning',
  amber: 'warning',
  grey: 'neutral',
  'grey-8': 'neutral',
  'grey-7': 'neutral',
}

export function resolveIntent(name) {
  if (!name) return DEFAULT_INTENT
  const key = String(name)
  if (ACTION_INTENTS[key]) return key
  if (ALIASES[key] && ACTION_INTENTS[ALIASES[key]]) return ALIASES[key]
  return DEFAULT_INTENT
}

export function intentConfig(name) {
  return ACTION_INTENTS[resolveIntent(name)]
}

/** `var(--app-action-edit)` for the given intent. */
export function intentVar(name) {
  return `var(--app-action-${intentConfig(name).token})`
}

/** Default icon for an intent ('' when the intent has no implicit icon). */
export function intentIcon(name) {
  return intentConfig(name).icon
}

export default ACTION_INTENTS
