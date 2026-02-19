import { simpleGit, SimpleGit } from 'simple-git'
import { promises as fs } from 'fs'
import path from 'path'
import { logger } from '../logger.js'
import type { GitStatus, GitCommit } from '@claude-sandbox/shared'

export interface RawWorktree {
  path: string
  head: string
  branch: string
  isBare: boolean
}

export class GitService {
  async listWorktrees(repoPath: string): Promise<RawWorktree[]> {
    const git = simpleGit(repoPath)
    const output = await git.raw(['worktree', 'list', '--porcelain'])
    const worktrees: RawWorktree[] = []

    for (const block of output.trim().split('\n\n')) {
      const lines = block.trim().split('\n')
      const wt: Partial<RawWorktree> = { isBare: false }
      for (const line of lines) {
        if (line.startsWith('worktree ')) wt.path = line.slice(9)
        else if (line.startsWith('HEAD ')) wt.head = line.slice(5)
        else if (line.startsWith('branch ')) wt.branch = line.slice(7).replace('refs/heads/', '')
        else if (line === 'bare') wt.isBare = true
        else if (line === 'detached') wt.branch = 'HEAD (detached)'
      }
      if (wt.path && wt.head) {
        worktrees.push(wt as RawWorktree)
      }
    }
    return worktrees
  }

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

  async fetch(repoPath: string): Promise<void> {
    const git = simpleGit(repoPath)
    await git.fetch('origin')
    logger.info('Fetched from origin', { path: repoPath })
  }

  /**
   * Verify worktree .git file exists and repair if missing.
   * The .git file in a worktree is a plain text file containing:
   * "gitdir: /path/to/main/repo/.git/worktrees/{session-id}"
   *
   * This can get corrupted if container operations delete or overwrite it.
   */
  async verifyAndRepairWorktree(repoPath: string, worktreePath: string): Promise<boolean> {
    const gitFile = path.join(worktreePath, '.git')
    const sessionId = path.basename(worktreePath)
    const expectedGitdir = path.join(repoPath, '.git', 'worktrees', sessionId)

    try {
      // Check if .git file exists
      const stat = await fs.stat(gitFile)
      if (stat.isFile()) {
        // File exists - verify content
        const content = await fs.readFile(gitFile, 'utf-8')
        if (content.includes('gitdir:')) {
          logger.debug('Worktree .git file is valid', { worktreePath })
          return true
        }
      }
    } catch {
      // .git file doesn't exist or can't be read
    }

    // Check if worktree entry exists in main repo
    try {
      await fs.access(expectedGitdir)
      // Worktree entry exists - recreate .git file
      const gitdirContent = `gitdir: ${expectedGitdir}\n`
      await fs.writeFile(gitFile, gitdirContent)
      logger.info('Repaired worktree .git file', { worktreePath, gitdir: expectedGitdir })
      return true
    } catch {
      // Worktree entry doesn't exist in main repo - fully re-create it
      logger.info('Re-creating worktree entry in main repo', { worktreePath, expectedGitdir })
      try {
        const git = simpleGit(repoPath)
        const log = await git.log({ maxCount: 1 })
        const headCommit = log.latest?.hash
        if (!headCommit) {
          logger.warn('Cannot repair worktree - no commits in repo', { repoPath })
          return false
        }

        await fs.mkdir(expectedGitdir, { recursive: true })
        await fs.writeFile(path.join(expectedGitdir, 'gitdir'), `${worktreePath}/.git\n`)
        await fs.writeFile(path.join(expectedGitdir, 'HEAD'), `${headCommit}\n`)
        await fs.writeFile(path.join(expectedGitdir, 'commondir'), `../..\n`)

        // Create .git file in worktree pointing to main repo entry
        await fs.writeFile(gitFile, `gitdir: ${expectedGitdir}\n`)
        logger.info('Fully repaired worktree git link', { worktreePath, expectedGitdir, head: headCommit })
        return true
      } catch (repairErr) {
        logger.warn('Failed to re-create worktree entry', { worktreePath, error: repairErr })
        return false
      }
    }
  }
}
