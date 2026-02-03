export type SessionStatus = 'pending' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error'

export interface SessionWorktree {
  path: string
  branch: string
  baseBranch?: string
  commit?: string
}

export interface SessionContainer {
  id: string
  ports: Record<number, number>
  serviceContainers?: string[]  // IDs of sidecar service containers
  networkId?: string
}

export interface Session {
  id: string
  projectId: string
  name: string
  status: SessionStatus
  worktree?: SessionWorktree
  container?: SessionContainer
  claudeSourceUser?: string
  gitUserName?: string
  gitUserEmail?: string
  githubToken?: string
  error?: string
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

export interface CreateSessionInput {
  name: string
  branch?: string
  claudeSourceUser?: string
  gitUserName?: string
  gitUserEmail?: string
  githubToken?: string
}

export interface SessionLogs {
  stdout: string
  stderr: string
}
