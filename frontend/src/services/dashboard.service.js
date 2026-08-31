import { http } from 'src/services/api'

export const dashboardService = {
  stats: () => http.get('/dashboard/stats'),
  charts: () => http.get('/dashboard/charts'),
  recentActivities: () => http.get('/dashboard/recent-activities'),
  upcoming: () => http.get('/dashboard/upcoming'),
}
