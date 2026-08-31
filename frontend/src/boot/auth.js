import { useAuthStore } from 'src/stores/auth'

/**
 * Restores the user session from localStorage before the app mounts.
 * If a token exists, the current user is fetched from the API; on failure
 * the stale session is cleared silently.
 */
export async function bootstrapAuth() {
  const authStore = useAuthStore()
  await authStore.bootstrap()
}
