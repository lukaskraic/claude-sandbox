/**
 * Container resource types for project-level management
 */

export type ContainerState = 'created' | 'running' | 'paused' | 'restarting' | 'removing' | 'exited' | 'dead'

export interface ProjectContainer {
  id: string
  name: string
  sessionId?: string
  sessionName?: string
  image: string
  state: ContainerState
  status: string  // Human-readable status like "Up 2 hours"
  created: Date
  ports: Record<number, number>  // container:host
  type: 'main' | 'service'
}

export interface ContainerImage {
  id: string
  tags: string[]
  size: number  // bytes
  created: Date
  projectId?: string
  configHash?: string
  usedByContainers: number
}

export interface ProjectNetwork {
  id: string
  name: string
  driver: string
  scope: string
  created: Date
  containers: string[]  // container IDs
}

export interface ProjectVolume {
  id: string
  name: string
  driver: string
  mountpoint: string
  created: Date
  size?: number  // bytes
  usedByContainers: string[]
}

export interface ContainerStats {
  containerId: string
  cpuPercent: number
  memoryUsage: number  // bytes
  memoryLimit: number  // bytes
  memoryPercent: number
  networkRx: number  // bytes
  networkTx: number  // bytes
  blockRead: number  // bytes
  blockWrite: number  // bytes
  pids: number
}

export interface ProjectResourceSummary {
  containers: {
    total: number
    running: number
    stopped: number
    orphaned: number
  }
  images: {
    total: number
    size: number  // total bytes
    unused: number
  }
  networks: {
    total: number
  }
  volumes: {
    total: number
    size: number  // total bytes
  }
}

export interface BatchOperationResult {
  succeeded: string[]  // IDs
  failed: Array<{ id: string; error: string }>
}
