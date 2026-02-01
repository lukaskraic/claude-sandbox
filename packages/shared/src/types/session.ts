export type SessionStatus = 'pending' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error'

export interface SessionWorktree {
  path: string
  branch: string
  commit?: string
}

export interface SessionContainer {
  id: string
  ports: Record<number, number>
}

export interface Session {
  id: string
  projectId: string
  name: string
  status: SessionStatus
  worktree?: SessionWorktree
  container?: SessionContainer
  error?: string
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

export interface CreateSessionInput {
  name: string
  branch?: string
}

export interface SessionLogs {
  stdout: string
  stderr: string
}
