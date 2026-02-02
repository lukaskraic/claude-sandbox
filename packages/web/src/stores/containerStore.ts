import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ProjectContainer,
  ContainerImage,
  ProjectNetwork,
  ProjectVolume,
  ContainerStats,
  ProjectResourceSummary,
  BatchOperationResult,
} from '@claude-sandbox/shared'
import { trpc } from '@/api/trpc'

export const useContainerStore = defineStore('container', () => {
  const containers = ref<ProjectContainer[]>([])
  const images = ref<ContainerImage[]>([])
  const networks = ref<ProjectNetwork[]>([])
  const volumes = ref<ProjectVolume[]>([])
  const stats = ref<Map<string, ContainerStats>>(new Map())
  const summary = ref<ProjectResourceSummary | null>(null)
  const orphanedContainers = ref<ProjectContainer[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const runningContainers = computed(() =>
    containers.value.filter(c => c.state === 'running')
  )

  const stoppedContainers = computed(() =>
    containers.value.filter(c => c.state !== 'running')
  )

  async function fetchContainers(projectId: string) {
    loading.value = true
    error.value = null
    try {
      containers.value = await trpc.container.listByProject.query({ projectId })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch containers'
    } finally {
      loading.value = false
    }
  }

  async function fetchImages(projectName: string) {
    loading.value = true
    error.value = null
    try {
      images.value = await trpc.container.listImages.query({ projectName })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch images'
    } finally {
      loading.value = false
    }
  }

  async function fetchNetworks(projectId: string) {
    loading.value = true
    error.value = null
    try {
      networks.value = await trpc.container.listNetworks.query({ projectId })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch networks'
    } finally {
      loading.value = false
    }
  }

  async function fetchVolumes(projectId: string) {
    loading.value = true
    error.value = null
    try {
      volumes.value = await trpc.container.listVolumes.query({ projectId })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch volumes'
    } finally {
      loading.value = false
    }
  }

  async function fetchSummary(projectId: string, projectName: string) {
    try {
      summary.value = await trpc.container.getSummary.query({ projectId, projectName })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch summary'
    }
  }

  async function fetchOrphans(projectId: string) {
    try {
      orphanedContainers.value = await trpc.container.findOrphans.query({ projectId })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch orphans'
    }
  }

  async function fetchAll(projectId: string, projectName: string) {
    loading.value = true
    error.value = null
    try {
      await Promise.all([
        fetchContainers(projectId),
        fetchImages(projectName),
        fetchNetworks(projectId),
        fetchVolumes(projectId),
        fetchSummary(projectId, projectName),
        fetchOrphans(projectId),
      ])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch resources'
    } finally {
      loading.value = false
    }
  }

  async function fetchContainerStats(containerId: string) {
    try {
      const containerStats = await trpc.container.getStats.query({ containerId })
      stats.value.set(containerId, containerStats)
      return containerStats
    } catch (err) {
      console.error('Failed to fetch container stats:', err)
      return null
    }
  }

  async function startContainer(containerId: string) {
    try {
      await trpc.container.start.mutate({ containerId })
      const container = containers.value.find(c => c.id === containerId)
      if (container) {
        container.state = 'running'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start container'
      throw err
    }
  }

  async function stopContainer(containerId: string) {
    try {
      await trpc.container.stop.mutate({ containerId })
      const container = containers.value.find(c => c.id === containerId)
      if (container) {
        container.state = 'exited'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to stop container'
      throw err
    }
  }

  async function removeContainer(containerId: string) {
    try {
      await trpc.container.remove.mutate({ containerId })
      containers.value = containers.value.filter(c => c.id !== containerId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove container'
      throw err
    }
  }

  async function batchStopContainers(containerIds: string[]): Promise<BatchOperationResult> {
    try {
      const result = await trpc.container.batchStop.mutate({ containerIds })
      for (const id of result.succeeded) {
        const container = containers.value.find(c => c.id === id)
        if (container) {
          container.state = 'exited'
        }
      }
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to batch stop containers'
      throw err
    }
  }

  async function batchRemoveContainers(containerIds: string[]): Promise<BatchOperationResult> {
    try {
      const result = await trpc.container.batchRemove.mutate({ containerIds })
      containers.value = containers.value.filter(c => !result.succeeded.includes(c.id))
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to batch remove containers'
      throw err
    }
  }

  async function removeImage(imageId: string) {
    try {
      await trpc.container.removeImage.mutate({ imageId })
      images.value = images.value.filter(i => i.id !== imageId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove image'
      throw err
    }
  }

  async function cleanupOrphans(projectId: string): Promise<BatchOperationResult> {
    try {
      const result = await trpc.container.cleanupOrphans.mutate({ projectId })
      containers.value = containers.value.filter(c => !result.succeeded.includes(c.id))
      orphanedContainers.value = []
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to cleanup orphans'
      throw err
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    containers,
    images,
    networks,
    volumes,
    stats,
    summary,
    orphanedContainers,
    loading,
    error,
    runningContainers,
    stoppedContainers,
    fetchContainers,
    fetchImages,
    fetchNetworks,
    fetchVolumes,
    fetchSummary,
    fetchOrphans,
    fetchAll,
    fetchContainerStats,
    startContainer,
    stopContainer,
    removeContainer,
    batchStopContainers,
    batchRemoveContainers,
    removeImage,
    cleanupOrphans,
    clearError,
  }
})
