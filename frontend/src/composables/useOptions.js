import { ref } from 'vue'
import {
  campusService, facultyService, departmentService,
  buildingService, floorService, roomService,
} from 'src/services/organization.service'
import { categoryService, subcategoryService, supplierService } from 'src/services/catalog.service'
import { userService, roleService } from 'src/services/users.service'
import { warehouseService } from 'src/services/warehouse.service'

/**
 * Shared option-list loader for entity selects (org structure, catalog,
 * users, roles, warehouses). Loads once per page instance and exposes the
 * option arrays + a reload function. All list endpoints accept ?per_page=100.
 */
export function useOptions() {
  const state = {}
  const list = (key, loader) => {
    if (!state[key]) {
      state[key] = ref([])
      state[key]._loading = loader().then(({ data }) => {
        state[key].value = data?.data || []
        return state[key].value
      }).catch(() => {
        state[key].value = []
      })
    }
    return state[key]
  }

  const opts = (rows, labelKey = 'name', valueKey = 'id') =>
    (rows || []).map((r) => ({ label: r[labelKey], value: r[valueKey], raw: r }))

  return {
    campuses: list('campuses', () => campusService.list({ per_page: 100 })),
    faculties: list('faculties', () => facultyService.list({ per_page: 100 })),
    departments: list('departments', () => departmentService.list({ per_page: 100 })),
    buildings: list('buildings', () => buildingService.list({ per_page: 100 })),
    floors: list('floors', () => floorService.list({ per_page: 100 })),
    rooms: list('rooms', () => roomService.list({ per_page: 100 })),
    categories: list('categories', () => categoryService.list({ per_page: 100 })),
    subcategories: list('subcategories', () => subcategoryService.list({ per_page: 100 })),
    suppliers: list('suppliers', () => supplierService.list({ per_page: 100 })),
    users: list('users', () => userService.list({ per_page: 100 })),
    roles: list('roles', () => roleService.list()),
    warehouses: list('warehouses', () => warehouseService.list({ per_page: 100 })),
    opts,
  }
}
