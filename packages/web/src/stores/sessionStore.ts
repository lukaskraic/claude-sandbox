import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, CreateSessionInput } from '@claude-sandbox/shared'
import { trpc } from '@/api/trpc'

export const useSessionStore = defineStore('session', () => {
  const sessions = ref<Session[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const sessionById = computed(() => {
    return (id: string) => sessions.value.find((s) => s.id === id)
  })

  const sessionsByProject = computed(() => {
    return (projectId: string) => sessions.value.filter((s) => s.projectId === projectId)
  })

  async function fetchSessions() {
    loading.value = true
    error.value = null
    try {
      sessions.value = await trpc.session.list.query()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch sessions'
    } finally {
      loading.value = false
    }
  }

  async function createSession(projectId: string, input: CreateSessionInput) {
    loading.value = true
    error.value = null
    try {
      const session = await trpc.session.create.mutate({ projectId, ...input })
      sessions.value.push(session)
      return session
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create session'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function startSession(id: string) {
    try {
      const session = await trpc.session.start.mutate({ id })
      const idx = sessions.value.findIndex((s) => s.id === id)
      if (idx !== -1) sessions.value[idx] = session
      return session
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start session'
      throw err
    }
  }

  async function stopSession(id: string) {
    try {
      const session = await trpc.session.stop.mutate({ id })
      const idx = sessions.value.findIndex((s) => s.id === id)
      if (idx !== -1) sessions.value[idx] = session
      return session
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to stop session'
      throw err
    }
  }

  async function removeSession(id: string) {
    try {
      await trpc.session.remove.mutate({ id })
      sessions.value = sessions.value.filter((s) => s.id !== id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove session'
      throw err
    }
  }

  function updateSession(session: Session) {
    const idx = sessions.value.findIndex((s) => s.id === session.id)
    if (idx !== -1) {
      sessions.value[idx] = session
    }
  }

  return {
    sessions,
    loading,
    error,
    sessionById,
    sessionsByProject,
    fetchSessions,
    createSession,
    startSession,
    stopSession,
    removeSession,
    updateSession,
  }
})
