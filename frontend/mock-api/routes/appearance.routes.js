import { ok, HttpError } from '../server.js'
import { sqlValue } from '../db.js'
import { log } from './crud.helper.js'

/**
 * Module 24b — Appearance / theme preferences.
 * Mirrors backend/routes/api/system.php (AppearanceController) 1:1.
 *
 *   GET    /api/appearance          the caller's preferences + org defaults + branding
 *   PUT    /api/appearance          persist the caller's preferences
 *   POST   /api/appearance/reset    delete them → fall back to the org default
 *   GET    /api/admin/appearance    organization defaults + branding (admins)
 *   PUT    /api/admin/appearance    update organization defaults + branding
 */

const MODES = ['light', 'dark', 'system']
const FONT_SIZES = ['S', 'M', 'L', 'XL']
const RADII = ['sharp', 'normal', 'round']
const SIDEBARS = ['mini', 'normal', 'expanded', 'floating']
const DENSITIES = ['compact', 'comfortable', 'spacious']
const CALENDARS = ['gregorian', 'solar']
const FONT_FAMILIES = ['inter', 'roboto', 'poppins', 'open-sans', 'noto-sans', 'arial']
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const COLOR_TOKENS = [
  'topBarStart', 'topBarEnd', 'sidebarBackground', 'sidebarActive',
  'primary', 'secondary', 'accent', 'accentBackground',
  'background', 'surface', 'card',
  'text', 'textSecondary',
  'border', 'hover', 'focus',
  'positive', 'negative', 'warning', 'info',
]

const SCHEME_IDS = [
  'softcora', 'steel', 'minimal', 'forest', 'royal', 'amber', 'dark',
  'pastel', 'vivid', 'neutral', 'gradient', 'crimson', 'teal',
]

function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

/** Row → API shape (snake_case, JSON columns decoded). */
function serialise(row) {
  if (!row) return null
  return {
    theme_mode: row.theme_mode,
    selected_theme: row.selected_theme,
    custom_colors: parseJson(row.custom_colors, null),
    font_family: row.font_family,
    font_size: row.font_size,
    font_weight: Number(row.font_weight ?? 400),
    line_height: Number(row.line_height ?? 1.5),
    border_radius: row.border_radius,
    sidebar_style: row.sidebar_style,
    table_density: row.table_density,
    animations_enabled: Boolean(Number(row.animations_enabled ?? 1)),
    calendar_type: row.calendar_type,
    layout_preferences: parseJson(row.layout_preferences, {}),
    accessibility_preferences: parseJson(row.accessibility_preferences, {}),
  }
}

function serialiseDefaults(row) {
  const base = serialise(row)
  if (!base) return null
  return {
    ...base,
    organization_name: row.organization_name || '',
    brand_name: row.brand_name || '',
    logo_url: row.logo_url || '',
    favicon_url: row.favicon_url || '',
  }
}

/** Validate + whitelist an incoming preferences payload. */
function validate(body = {}) {
  const errors = {}
  const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback)

  if (body.theme_mode !== undefined && !MODES.includes(body.theme_mode)) {
    errors.theme_mode = ['The selected display mode is not supported.']
  }
  if (body.selected_theme !== undefined && !SCHEME_IDS.includes(body.selected_theme)) {
    errors.selected_theme = ['The selected theme is not available.']
  }
  if (body.font_size !== undefined && !FONT_SIZES.includes(body.font_size)) {
    errors.font_size = ['The selected font size is not supported.']
  }
  if (body.border_radius !== undefined && !RADII.includes(body.border_radius)) {
    errors.border_radius = ['The selected corner radius is not supported.']
  }
  if (body.sidebar_style !== undefined && !SIDEBARS.includes(body.sidebar_style)) {
    errors.sidebar_style = ['The selected sidebar style is not supported.']
  }
  if (body.table_density !== undefined && !DENSITIES.includes(body.table_density)) {
    errors.table_density = ['The selected table density is not supported.']
  }
  if (body.calendar_type !== undefined && !CALENDARS.includes(body.calendar_type)) {
    errors.calendar_type = ['The selected calendar is not supported.']
  }
  if (body.font_family !== undefined && !FONT_FAMILIES.includes(body.font_family)) {
    errors.font_family = ['The selected font family is not available.']
  }
  if (body.font_weight !== undefined && ![300, 400, 500, 600, 700, 800].includes(Number(body.font_weight))) {
    errors.font_weight = ['The font weight must be between 300 and 800.']
  }
  if (body.line_height !== undefined && !(Number(body.line_height) >= 1 && Number(body.line_height) <= 2.5)) {
    errors.line_height = ['The line height must be between 1 and 2.5.']
  }

  const custom = body.custom_colors
  if (custom !== undefined && custom !== null) {
    if (typeof custom !== 'object' || Array.isArray(custom)) {
      errors.custom_colors = ['Custom colours must be an object of hex values.']
    } else {
      for (const [key, value] of Object.entries(custom)) {
        if (!COLOR_TOKENS.includes(key)) {
          errors.custom_colors = [`Unknown colour token "${key}".`]
          break
        }
        if (value !== null && !HEX.test(String(value))) {
          errors.custom_colors = [`"${key}" must be a valid hex colour (e.g. #2E7D32).`]
          break
        }
      }
    }
  }

  for (const key of ['layout_preferences', 'accessibility_preferences']) {
    const value = body[key]
    if (value !== undefined && value !== null && (typeof value !== 'object' || Array.isArray(value))) {
      errors[key] = [`${key} must be an object.`]
    }
  }

  if (Object.keys(errors).length) throw new HttpError(422, 'Validation failed', errors)

  return {
    theme_mode: pick(body.theme_mode, MODES, undefined),
    selected_theme: pick(body.selected_theme, SCHEME_IDS, undefined),
    custom_colors: custom === null ? null : custom === undefined ? undefined : JSON.stringify(custom),
    font_family: pick(body.font_family, FONT_FAMILIES, undefined),
    font_size: pick(body.font_size, FONT_SIZES, undefined),
    font_weight: body.font_weight === undefined ? undefined : Number(body.font_weight),
    line_height: body.line_height === undefined ? undefined : Number(body.line_height),
    border_radius: pick(body.border_radius, RADII, undefined),
    sidebar_style: pick(body.sidebar_style, SIDEBARS, undefined),
    table_density: pick(body.table_density, DENSITIES, undefined),
    animations_enabled: body.animations_enabled === undefined ? undefined : (body.animations_enabled ? 1 : 0),
    calendar_type: pick(body.calendar_type, CALENDARS, undefined),
    layout_preferences: body.layout_preferences === undefined ? undefined : JSON.stringify(body.layout_preferences || {}),
    accessibility_preferences:
      body.accessibility_preferences === undefined ? undefined : JSON.stringify(body.accessibility_preferences || {}),
  }
}

function defaultsRow(db) {
  return db.prepare('SELECT * FROM appearance_defaults WHERE id = 1').get()
}

function userRow(db, userId) {
  return db.prepare('SELECT * FROM user_appearances WHERE user_id = ?').get(userId)
}

function upsertUser(db, userId, values) {
  const now = new Date().toISOString()
  const defined = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined))
  const existing = userRow(db, userId)

  if (!existing) {
    const row = { user_id: userId, created_at: now, updated_at: now, ...defined }
    const keys = Object.keys(row)
    db.prepare(
      `INSERT INTO user_appearances (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    ).run(...keys.map((k) => sqlValue(row[k])))
    return userRow(db, userId)
  }

  const keys = Object.keys(defined)
  if (keys.length) {
    db.prepare(
      `UPDATE user_appearances SET ${keys.map((k) => `"${k}" = ?`).join(', ')}, updated_at = ? WHERE user_id = ?`,
    ).run(...keys.map((k) => sqlValue(defined[k])), now, userId)
  }
  return userRow(db, userId)
}

function canManage(ctx) {
  const roles = ctx.router?.userRoles?.(ctx.user) || []
  if (roles.includes('Super Admin')) return true
  const perms = ctx.router?.userPermissions?.(ctx.user) || []
  return perms.includes('appearance.manage') || perms.includes('settings.manage')
}

export function appearanceRoutes(router) {
  const withRouter = (ctx) => ({ ...ctx, router })

  // GET /api/appearance -------------------------------------------------------
  router.get('/api/appearance', (rawCtx) => {
    const ctx = withRouter(rawCtx)
    const { db, user } = ctx
    const row = userRow(db, user.id)
    return ok('Appearance preferences retrieved successfully.', {
      user: serialise(row),
      system: serialiseDefaults(defaultsRow(db)),
      branding: brandingOf(defaultsRow(db)),
      can_manage_system: canManage(ctx),
    })
  }, { auth: true })

  // PUT /api/appearance -------------------------------------------------------
  router.put('/api/appearance', (rawCtx) => {
    const ctx = withRouter(rawCtx)
    const values = validate(ctx.body)
    const row = upsertUser(ctx.db, ctx.user.id, values)
    log(ctx, 'updated', 'Appearance', { id: ctx.user.id, name: `${ctx.user.name} appearance` })
    return ok('Appearance preferences saved successfully.', {
      user: serialise(row),
      system: serialiseDefaults(defaultsRow(ctx.db)),
    })
  }, { auth: true })

  // POST /api/appearance/reset ------------------------------------------------
  router.post('/api/appearance/reset', (rawCtx) => {
    const ctx = withRouter(rawCtx)
    ctx.db.prepare('DELETE FROM user_appearances WHERE user_id = ?').run(ctx.user.id)
    log(ctx, 'reset', 'Appearance', { id: ctx.user.id, name: `${ctx.user.name} appearance` })
    return ok('Appearance preferences restored to the system default.', {
      user: null,
      system: serialiseDefaults(defaultsRow(ctx.db)),
    })
  }, { auth: true })

  // GET /api/admin/appearance -------------------------------------------------
  router.get('/api/admin/appearance', (rawCtx) => {
    const ctx = withRouter(rawCtx)
    return ok('System default appearance retrieved successfully.', {
      defaults: serialiseDefaults(defaultsRow(ctx.db)),
      branding: brandingOf(defaultsRow(ctx.db)),
      can_manage_system: true,
    })
  }, { auth: true, permission: 'appearance.manage|settings.manage' })

  // PUT /api/admin/appearance -------------------------------------------------
  router.put('/api/admin/appearance', (rawCtx) => {
    const ctx = withRouter(rawCtx)
    const body = ctx.body || {}
    const values = validate(body.defaults || body)
    const branding = body.branding && typeof body.branding === 'object' ? body.branding : {}

    const now = new Date().toISOString()
    const defined = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined))
    const brandFields = {}
    for (const key of ['organization_name', 'brand_name', 'logo_url', 'favicon_url']) {
      if (branding[key] !== undefined) {
        const value = String(branding[key] ?? '').trim()
        if (value.length > 255) throw new HttpError(422, 'Validation failed', { [key]: ['Must not exceed 255 characters.'] })
        brandFields[key] = value || null
      }
    }

    const keys = [...Object.keys(defined), ...Object.keys(brandFields)]
    if (keys.length) {
      const merged = { ...defined, ...brandFields }
      ctx.db.prepare(
        `UPDATE appearance_defaults SET ${keys.map((k) => `"${k}" = ?`).join(', ')}, updated_by = ?, updated_at = ? WHERE id = 1`,
      ).run(...keys.map((k) => sqlValue(merged[k])), ctx.user.id, now)
    }

    log(ctx, 'updated', 'Appearance', { id: 1, name: 'System default appearance' })
    return ok('System default appearance saved successfully.', {
      defaults: serialiseDefaults(defaultsRow(ctx.db)),
      branding: brandingOf(defaultsRow(ctx.db)),
    })
  }, { auth: true, permission: 'appearance.manage|settings.manage' })
}

function brandingOf(row) {
  if (!row) return { organizationName: '', brandName: '', logoUrl: '', faviconUrl: '' }
  return {
    organizationName: row.organization_name || '',
    brandName: row.brand_name || '',
    logoUrl: row.logo_url || '',
    faviconUrl: row.favicon_url || '',
  }
}
