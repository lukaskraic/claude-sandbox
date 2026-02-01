import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project, CreateProjectInput } from '@claude-sandbox/shared'
import { trpc } from '@/api/trpc'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const projectById = computed(() => {
    return (id: string) => projects.value.find((p) => p.id === id)
  })

  async function fetchProjects() {
    loading.value = true
    error.value = null
    try {
      projects.value = await trpc.project.list.query()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch projects'
    } finally {
      loading.value = false
    }
  }

  async function createProject(input: CreateProjectInput) {
    loading.value = true
    error.value = null
    try {
      const project = await trpc.project.create.mutate(input)
      projects.value.push(project)
      return project
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create project'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteProject(id: string) {
    loading.value = true
    error.value = null
    try {
      await trpc.project.delete.mutate({ id })
      projects.value = projects.value.filter((p) => p.id !== id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete project'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    projects,
    loading,
    error,
    projectById,
    fetchProjects,
    createProject,
    deleteProject,
  }
})
