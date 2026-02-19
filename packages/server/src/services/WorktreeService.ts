import path from 'path'
import { promises as fs } from 'fs'
import { logger } from '../logger.js'
import type { GitService } from './GitService.js'
import type { SessionRepository } from '../db/repositories/SessionRepository.js'
import type { ProjectRepository } from '../db/repositories/ProjectRepository.js'
import type { Config } from '../config.js'
import type { WorktreeInfo } from '@claude-sandbox/shared'

export class WorktreeService {
  constructor(
    private gitService: GitService,
    private sessionRepo: SessionRepository,
    private projectRepo: ProjectRepository,
    private config: Config,
  ) {}

  async listAll(): Promise<WorktreeInfo[]> {
    const results: WorktreeInfo[] = []
    const sessions = this.sessionRepo.findAll()
    const projects = this.projectRepo.findAll()

    // Build worktree_path → session lookup
    const sessionByPath = new Map<string, { id: string; name: string; status: string }>()
    for (const s of sessions) {
      if (s.worktree?.path) {
        sessionByPath.set(s.worktree.path, { id: s.id, name: s.name, status: s.status })
      }
    }

    // Scan worktreeBase for project directories
    let projectDirs: string[]
    try {
      const entries = await fs.readdir(this.config.worktreeBase, { withFileTypes: true })
      projectDirs = entries.filter(e => e.isDirectory()).map(e => e.name)
    } catch {
      return []
    }

    for (const projectName of projectDirs) {
      const repoPath = path.join(this.config.dataDir, 'repos', projectName)
      const worktreeDir = path.join(this.config.worktreeBase, projectName)

      // Get git's view of worktrees
      const gitWorktrees = new Map<string, { head: string; branch: string }>()
      try {
        const rawList = await this.gitService.listWorktrees(repoPath)
        for (const wt of rawList) {
          if (!wt.isBare) {
            gitWorktrees.set(wt.path, { head: wt.head, branch: wt.branch })
          }
        }
      } catch (err) {
        logger.warn('Failed to list git worktrees', { repoPath, error: err })
      }

      // Also scan filesystem to catch dirs git may not know about
      let fsDirs: string[]
      try {
        const entries = await fs.readdir(worktreeDir, { withFileTypes: true })
        fsDirs = entries.filter(e => e.isDirectory()).map(e => e.name)
      } catch {
        continue
      }

      for (const dirName of fsDirs) {
        const wtPath = path.join(worktreeDir, dirName)
        const gitInfo = gitWorktrees.get(wtPath)
        const sessionInfo = sessionByPath.get(wtPath)

        // Check claude-state existence
        const claudeStatePath = path.join(this.config.dataDir, 'claude-state', dirName)
        let claudeStateExists = false
        try {
          await fs.access(claudeStatePath)
          claudeStateExists = true
        } catch {}

        // Get last modified time
        let lastModified: string | undefined
        try {
          const stat = await fs.stat(wtPath)
          lastModified = stat.mtime.toISOString()
        } catch {}

        results.push({
          path: wtPath,
          branch: gitInfo?.branch || 'unknown',
          commit: gitInfo?.head || 'unknown',
          projectName,
          isMainWorktree: false,
          session: sessionInfo ? {
            id: sessionInfo.id,
            name: sessionInfo.name,
            status: sessionInfo.status as any,
          } : undefined,
          claudeStateExists,
          lastModified,
        })

        // Remove from gitWorktrees so we don't double-count
        gitWorktrees.delete(wtPath)
      }

      // Add any git worktrees that exist in git but weren't found on filesystem scan
      // (shouldn't happen normally but handles edge cases)
      for (const [wtPath, gitInfo] of gitWorktrees) {
        // Skip the main repo worktree
        if (wtPath === repoPath) continue
        // Skip worktrees outside our worktree base
        if (!wtPath.startsWith(worktreeDir)) continue

        const dirName = path.basename(wtPath)
        const sessionInfo = sessionByPath.get(wtPath)
        const claudeStatePath = path.join(this.config.dataDir, 'claude-state', dirName)
        let claudeStateExists = false
        try {
          await fs.access(claudeStatePath)
          claudeStateExists = true
        } catch {}

        results.push({
          path: wtPath,
          branch: gitInfo.branch,
          commit: gitInfo.head,
          projectName,
          isMainWorktree: false,
          session: sessionInfo ? {
            id: sessionInfo.id,
            name: sessionInfo.name,
            status: sessionInfo.status as any,
          } : undefined,
          claudeStateExists,
        })
      }
    }

    return results
  }

  async listAvailable(projectId: string): Promise<WorktreeInfo[]> {
    const project = this.projectRepo.findById(projectId)
    if (!project) throw new Error(`Project not found: ${projectId}`)

    const all = await this.listAll()
    return all.filter(wt =>
      wt.projectName === project.name &&
      (!wt.session || wt.session.status === 'stopped' || wt.session.status === 'error')
    )
  }

  async deleteWorktree(worktreePath: string, cleanClaudeState: boolean): Promise<void> {
    // Path validation - prevent traversal
    const resolved = path.resolve(worktreePath)
    if (!resolved.startsWith(path.resolve(this.config.worktreeBase))) {
      throw new Error('Invalid worktree path: must be under worktree base directory')
    }

    // Check if any running session uses this worktree
    const sessions = this.sessionRepo.findAll()
    for (const s of sessions) {
      if (s.worktree?.path === resolved) {
        if (s.status === 'running' || s.status === 'starting') {
          throw new Error(`Cannot delete worktree: session "${s.name}" is ${s.status}`)
        }
        // Clear worktree reference from stopped/error sessions
        this.sessionRepo.clearWorktree(s.id)
        logger.info('Cleared worktree reference from session', { sessionId: s.id, sessionName: s.name })
      }
    }

    // Determine repo path from worktree path: {worktreeBase}/{projectName}/{id}
    const projectName = path.basename(path.dirname(resolved))
    const repoPath = path.join(this.config.dataDir, 'repos', projectName)
    const dirName = path.basename(resolved)

    // Try git worktree remove first, fall back to direct fs removal
    try {
      await this.gitService.removeWorktree(repoPath, resolved)
    } catch (err) {
      logger.warn('git worktree remove failed, removing directory directly', { path: resolved, error: err })
      await fs.rm(resolved, { recursive: true, force: true })
    }

    // Clean up claude-state if requested
    if (cleanClaudeState) {
      const claudeStatePath = path.join(this.config.dataDir, 'claude-state', dirName)
      try {
        await fs.rm(claudeStatePath, { recursive: true, force: true })
        logger.info('Removed claude-state', { path: claudeStatePath })
      } catch {}
    }

    logger.info('Worktree deleted', { path: resolved, cleanClaudeState })
  }
}
