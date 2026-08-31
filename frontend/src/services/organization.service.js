import { makeCrudService } from './crud.factory'

/**
 * Module 4 — University organization structure.
 */
export const campusService = makeCrudService('campuses')
export const facultyService = makeCrudService('faculties')
export const departmentService = makeCrudService('departments')
export const buildingService = makeCrudService('buildings')
export const floorService = makeCrudService('floors')
export const roomService = makeCrudService('rooms')
