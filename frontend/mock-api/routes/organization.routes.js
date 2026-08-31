import { registerCrud } from './crud.helper.js'

/**
 * Module 4 — University organization structure.
 */
export function organizationRoutes(router) {
  registerCrud(router, {
    base: 'campuses', table: 'campuses', searchable: ['code', 'name'],
    perms: 'organization', logModule: 'Organization',
  })
  registerCrud(router, {
    base: 'faculties', table: 'faculties', searchable: ['code', 'name'],
    perms: 'organization', logModule: 'Organization',
  })
  registerCrud(router, {
    base: 'departments', table: 'departments', searchable: ['code', 'name'],
    perms: 'organization', logModule: 'Organization',
  })
  registerCrud(router, {
    base: 'buildings', table: 'buildings', searchable: ['code', 'name'],
    perms: 'organization', logModule: 'Organization',
  })
  registerCrud(router, {
    base: 'floors', table: 'floors', searchable: ['code', 'name'],
    perms: 'organization', logModule: 'Organization',
  })
  registerCrud(router, {
    base: 'rooms', table: 'rooms', searchable: ['code', 'name'],
    perms: 'organization', logModule: 'Organization',
  })
}
