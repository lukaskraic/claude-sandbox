import type { SessionStatus } from './session.js'

export interface WorktreeInfo {
  path: string
  branch: string
  commit: string
  projectName: string
  isMainWorktree: boolean
  session?: {
    id: string
    name: string
    status: SessionStatus
  }
  claudeStateExists: boolean
  lastModified?: string
  diffSummary?: {
    filesChanged: number
    insertions: number
    deletions: number
  }
}
