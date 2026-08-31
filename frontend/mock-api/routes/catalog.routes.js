import { registerCrud } from './crud.helper.js'

/**
 * Module 5 — Categories/subcategories; Module 15 — Suppliers.
 */
export function catalogRoutes(router) {
  registerCrud(router, {
    base: 'categories', table: 'asset_categories', searchable: ['code', 'name'],
    perms: 'categories', logModule: 'Categories',
  })
  registerCrud(router, {
    base: 'subcategories', table: 'asset_subcategories', searchable: ['code', 'name'],
    perms: 'categories', logModule: 'Categories',
  })
  registerCrud(router, {
    base: 'suppliers', table: 'suppliers',
    searchable: ['code', 'name', 'company_name', 'contact_person', 'email'],
    perms: 'suppliers', logModule: 'Suppliers',
  })
}
