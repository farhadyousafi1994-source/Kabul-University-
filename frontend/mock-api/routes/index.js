import { authRoutes } from './auth.routes.js'
import { dashboardRoutes } from './dashboard.routes.js'
import { notificationRoutes } from './notifications.routes.js'
import { activityRoutes } from './activity.routes.js'
import { userRoutes } from './users.routes.js'

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
}
