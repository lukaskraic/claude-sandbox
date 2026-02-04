import { ref, computed } from 'vue'
import { trpc } from '../api/trpc'

const user = ref<string | null>(null)
const authRequired = ref(true)
const loading = ref(true)
const error = ref<string | null>(null)
const initialized = ref(false)

export function useAuthStore() {
  const isAuthenticated = computed(() => !authRequired.value || user.value !== null)

  async function checkAuth(): Promise<void> {
    if (initialized.value) return

    loading.value = true
    error.value = null

    try {
      const result = await trpc.auth.me.query()
      user.value = result.user
      authRequired.value = result.authRequired
      initialized.value = true
    } catch (err) {
      console.error('Auth check failed:', err)
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function login(username: string, password: string): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.auth.login.mutate({ username, password })
      user.value = result.username
      return true
    } catch (err: any) {
      error.value = err.message || 'Login failed'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    loading.value = true

    try {
      await trpc.auth.logout.mutate()
    } catch (err) {
      console.error('Logout failed:', err)
    } finally {
      user.value = null
      loading.value = false
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    user,
    authRequired,
    loading,
    error,
    isAuthenticated,
    checkAuth,
    login,
    logout,
    clearError,
  }
}
