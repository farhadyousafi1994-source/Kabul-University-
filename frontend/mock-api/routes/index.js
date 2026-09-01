import { authRoutes } from './auth.routes.js'
import { dashboardRoutes } from './dashboard.routes.js'
import { notificationRoutes } from './notifications.routes.js'
import { activityRoutes } from './activity.routes.js'
import { userRoutes } from './users.routes.js'
import { organizationRoutes } from './organization.routes.js'
import { catalogRoutes } from './catalog.routes.js'
import { assetRoutes } from './assets.routes.js'
import { assignmentRoutes, transferRoutes, assetRequestRoutes } from './operations.routes.js'
import { maintenanceRoutes } from './maintenance.routes.js'
import { auditRoutes, procurementRoutes } from './audit-procurement.routes.js'
import { warehouseRoutes } from './warehouse.routes.js'
import { depreciationRoutes, disposalRoutes } from './financial.routes.js'
import { settingsRoutes, reportRoutes } from './system.routes.js'
import { backupRoutes } from './backup.routes.js'

/**
 * Registers every module's route group on the mock router.
 * Keep this list in sync with backend/routes/api.php groups.
 */
export function registerRoutes(router) {
  authRoutes(router)
  dashboardRoutes(router)
  notificationRoutes(router)
  activityRoutes(router)
  userRoutes(router)
  organizationRoutes(router)
  catalogRoutes(router)
  assetRoutes(router)
  assignmentRoutes(router)
  transferRoutes(router)
  assetRequestRoutes(router)
  maintenanceRoutes(router)
  auditRoutes(router)
  procurementRoutes(router)
  warehouseRoutes(router)
  depreciationRoutes(router)
  disposalRoutes(router)
  settingsRoutes(router)
  reportRoutes(router)
  backupRoutes(router)
}
