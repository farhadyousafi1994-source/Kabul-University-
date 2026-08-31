import { makeCrudService } from './crud.factory'

/**
 * Module 5 — Categories/subcategories; Module 15 — Suppliers.
 */
export const categoryService = makeCrudService('categories')
export const subcategoryService = makeCrudService('subcategories')
export const supplierService = makeCrudService('suppliers')
