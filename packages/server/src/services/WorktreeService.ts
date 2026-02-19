import path from 'path'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import { simpleGit } from 'simple-git'
import { logger } from '../logger.js'
import type { GitService } from './GitService.js'
import type { SessionRepository } from '../db/repositories/SessionRepository.js'
import type { ProjectRepository } from '../db/repositories/ProjectRepository.js'
import type { Config } from '../config.js'
import type { WorktreeInfo } from '@claude-sandbox/shared'

const execAsync = promisify(exec)

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

        // Get diff summary using git CLI with safe.directory bypass (worktrees may be owned by container users)
        let diffSummary: WorktreeInfo['diffSummary']
        try {
          const gitCmd = `git -C "${wtPath}" -c safe.directory="*"`
          const { stdout: shortstat } = await execAsync(`${gitCmd} diff --shortstat`)
          const { stdout: porcelain } = await execAsync(`${gitCmd} status --porcelain`)

          // Parse --shortstat: " 3 files changed, 10 insertions(+), 5 deletions(-)"
          let trackedFiles = 0, insertions = 0, deletions = 0
          const statMatch = shortstat.match(/(\d+) file/)
          if (statMatch) trackedFiles = parseInt(statMatch[1])
          const insMatch = shortstat.match(/(\d+) insertion/)
          if (insMatch) insertions = parseInt(insMatch[1])
          const delMatch = shortstat.match(/(\d+) deletion/)
          if (delMatch) deletions = parseInt(delMatch[1])

          // Count untracked files from porcelain status (lines starting with "??")
          const untrackedCount = porcelain.split('\n').filter(l => l.startsWith('??')).length
          // Count modified/added/deleted from porcelain (non-empty, non-untracked)
          const stagedOrModified = porcelain.split('\n').filter(l => l.length > 0 && !l.startsWith('??')).length
          const totalFiles = Math.max(trackedFiles, stagedOrModified) + untrackedCount

          if (totalFiles > 0) {
            diffSummary = {
              filesChanged: totalFiles,
              insertions,
              deletions,
            }
          }
        } catch (err) {
          logger.warn('Failed to get diff for worktree', { path: wtPath, error: (err as Error).message })
        }

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
          diffSummary,
        })

        // Remove from gitWorktrees so we don't double-count
        gitWorktrees.delete(wtPath)
      }

      // Add any git worktrees that exist in git but weren't found on filesystem scan
      for (const [wtPath, gitInfo] of gitWorktrees) {
        if (wtPath === repoPath) continue
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
        this.sessionRepo.clearWorktree(s.id)
        logger.info('Cleared worktree reference from session', { sessionId: s.id, sessionName: s.name })
      }
    }

    const projectName = path.basename(path.dirname(resolved))
    const repoPath = path.join(this.config.dataDir, 'repos', projectName)
    const dirName = path.basename(resolved)

    // Try git worktree remove first
    try {
      await this.gitService.removeWorktree(repoPath, resolved)
    } catch (err) {
      logger.warn('git worktree remove failed, using sudo rm -rf', { path: resolved, error: err })
      // Worktree dirs may have files owned by different users (container UIDs)
      // Requires sudoers: claude-sandbox NOPASSWD: /usr/bin/rm -rf /srv/claude-sandbox/worktrees/*
      try {
        await execAsync(`sudo rm -rf ${resolved}`)
      } catch (rmErr) {
        logger.error('Failed to delete worktree directory', { path: resolved, error: rmErr })
        throw new Error(`Failed to delete worktree: permission denied`)
      }
    }

    // Prune stale worktree references from git
    try {
      const git = simpleGit(repoPath)
      await git.raw(['worktree', 'prune'])
    } catch {}

    // Verify deletion
    try {
      await fs.access(resolved)
      // Still exists - throw error
      throw new Error(`Worktree directory still exists after deletion attempt`)
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err
      // ENOENT = directory gone = success
    }

    // Clean up claude-state if requested
    if (cleanClaudeState) {
      const claudeStatePath = path.join(this.config.dataDir, 'claude-state', dirName)
      try {
        await execAsync(`sudo rm -rf ${claudeStatePath}`)
        logger.info('Removed claude-state', { path: claudeStatePath })
      } catch {}
    }

    logger.info('Worktree deleted', { path: resolved, cleanClaudeState })
  }
}
