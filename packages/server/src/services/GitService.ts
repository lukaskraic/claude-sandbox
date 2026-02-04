import { simpleGit, SimpleGit } from 'simple-git'
import { promises as fs } from 'fs'
import path from 'path'
import { logger } from '../logger.js'
import type { GitStatus, GitCommit } from '@claude-sandbox/shared'

export class GitService {
  async cloneIfNeeded(remote: string, localPath: string, defaultBranch: string): Promise<void> {
    try {
      await fs.access(localPath)
      logger.debug('Repository already exists', { path: localPath })
    } catch {
      logger.info('Cloning repository', { remote, path: localPath })
      await fs.mkdir(path.dirname(localPath), { recursive: true })
      const git = simpleGit()
      await git.clone(remote, localPath, ['--branch', defaultBranch])
    }
  }

  async createWorktree(repoPath: string, worktreePath: string, branch: string, baseBranch?: string): Promise<string> {
    const git = simpleGit(repoPath)

    // Check if worktree already exists and is valid
    try {
      await fs.access(worktreePath)

      // Directory exists - check if it's a valid git worktree (has .git file)
      const gitFile = path.join(worktreePath, '.git')
      try {
        await fs.access(gitFile)
        // .git file exists - try to use the worktree
        logger.info('Worktree already exists', { worktreePath, branch })
        const worktreeGit = simpleGit(worktreePath)
        const log = await worktreeGit.log({ maxCount: 1 })
        return log.latest?.hash || ''
      } catch {
        // .git file missing - worktree is corrupted, remove and recreate
        logger.warn('Worktree directory exists but is corrupted (missing .git), removing', { worktreePath })
        await fs.rm(worktreePath, { recursive: true, force: true })
        // Also prune stale worktree entries
        await git.raw(['worktree', 'prune']).catch(() => {})
      }
    } catch {
      // Worktree doesn't exist, create it
    }

    await fs.mkdir(path.dirname(worktreePath), { recursive: true })

    const branches = await git.branch()
    const branchExists = branches.all.includes(branch) || branches.all.includes(`remotes/origin/${branch}`)

    if (branchExists) {
      // Branch exists - try to use it, but it might fail if already checked out elsewhere
      try {
        await git.raw(['worktree', 'add', worktreePath, branch])
      } catch (err) {
        // If branch is already used, create a unique branch from it
        const uniqueBranch = `${branch}-${Date.now()}`
        logger.info('Branch already in use, creating unique branch', { originalBranch: branch, uniqueBranch })
        await git.raw(['worktree', 'add', '-b', uniqueBranch, worktreePath, `origin/${branch}`])
        branch = uniqueBranch
      }
    } else {
      // Create new branch from baseBranch or HEAD
      const startPoint = baseBranch ? `origin/${baseBranch}` : 'HEAD'
      await git.raw(['worktree', 'add', '-b', branch, worktreePath, startPoint])
    }

    logger.info('Created worktree', { repoPath, worktreePath, branch })

    const worktreeGit = simpleGit(worktreePath)
    const log = await worktreeGit.log({ maxCount: 1 })
    return log.latest?.hash || ''
  }

  async removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
    const git = simpleGit(repoPath)
    await git.raw(['worktree', 'remove', worktreePath, '--force'])
    logger.info('Removed worktree', { worktreePath })
  }

  async getStatus(worktreePath: string): Promise<GitStatus> {
    const git = simpleGit(worktreePath)
    const status = await git.status()

    let ahead = 0
    let behind = 0

    try {
      const tracking = await git.raw(['rev-list', '--left-right', '--count', `${status.tracking}...HEAD`])
      const [behindStr, aheadStr] = tracking.trim().split(/\s+/)
      behind = parseInt(behindStr) || 0
      ahead = parseInt(aheadStr) || 0
    } catch {
      // No tracking branch
    }

    return {
      branch: status.current || 'HEAD',
      ahead,
      behind,
      staged: status.staged,
      unstaged: status.modified,
      untracked: status.not_added,
    }
  }

  async getDiff(worktreePath: string, staged: boolean = false): Promise<string> {
    const git = simpleGit(worktreePath)
    return staged ? await git.diff(['--staged']) : await git.diff()
  }

  async getLog(worktreePath: string, limit: number = 20): Promise<GitCommit[]> {
    const git = simpleGit(worktreePath)
    const log = await git.log({ maxCount: limit })

    return log.all.map((commit) => ({
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name,
      date: new Date(commit.date),
    }))
  }

  async commit(worktreePath: string, message: string, files?: string[]): Promise<string> {
    const git = simpleGit(worktreePath)

    if (files && files.length > 0) {
      await git.add(files)
    } else {
      await git.add('.')
    }

    const result = await git.commit(message)
    logger.info('Created commit', { hash: result.commit, message })
    return result.commit
  }

  async push(worktreePath: string): Promise<void> {
    const git = simpleGit(worktreePath)
    await git.push()
    logger.info('Pushed changes', { path: worktreePath })
  }

  async pull(worktreePath: string): Promise<void> {
    const git = simpleGit(worktreePath)
    await git.pull()
    logger.info('Pulled changes', { path: worktreePath })
  }
}
