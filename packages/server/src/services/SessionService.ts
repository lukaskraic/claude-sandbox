import path from 'path'
import { promises as fs } from 'fs'
import type { Session, CreateSessionInput, Project } from '@claude-sandbox/shared'
import { SessionRepository } from '../db/repositories/SessionRepository.js'
import { ProjectRepository } from '../db/repositories/ProjectRepository.js'
import { GitService } from './GitService.js'
import { ContainerService } from './ContainerService.js'
import { logger } from '../logger.js'
import type { Config } from '../config.js'

export class SessionService {
  constructor(
    private sessionRepo: SessionRepository,
    private projectRepo: ProjectRepository,
    private gitService: GitService,
    private containerService: ContainerService,
    private config: Config
  ) {}

  async list(): Promise<Session[]> {
    return this.sessionRepo.findAll()
  }

  async listByProject(projectId: string): Promise<Session[]> {
    return this.sessionRepo.findByProjectId(projectId)
  }

  async get(id: string): Promise<Session | null> {
    return this.sessionRepo.findById(id)
  }

  async create(projectId: string, input: CreateSessionInput, createdBy?: string): Promise<Session> {
    const project = this.projectRepo.findById(projectId)
    if (!project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    const session = this.sessionRepo.create(projectId, input, createdBy)
    logger.info('Session created', { id: session.id, project: project.name })
    return session
  }

  async start(id: string): Promise<Session> {
    const session = this.sessionRepo.findById(id)
    if (!session) {
      throw new Error(`Session not found: ${id}`)
    }

    if (session.status === 'running') {
      return session
    }

    const project = this.projectRepo.findById(session.projectId)
    if (!project) {
      throw new Error(`Project not found: ${session.projectId}`)
    }

    this.sessionRepo.updateStatus(id, 'starting')

    try {
      const repoPath = path.join(this.config.dataDir, 'repos', project.name)
      await this.gitService.cloneIfNeeded(project.git.remote, repoPath, project.git.defaultBranch)

      const branch = session.worktree?.branch || `session/${session.id.slice(0, 8)}`
      const worktreePath = path.join(this.config.worktreeBase, project.name, session.id)

      const commit = await this.gitService.createWorktree(repoPath, worktreePath, branch)
      this.sessionRepo.updateWorktree(id, worktreePath, branch, commit)

      if (project.setup) {
        const setupScript = path.join(worktreePath, '.claude-sandbox-setup.sh')
        await fs.writeFile(setupScript, project.setup, { mode: 0o755 })
      }

      if (project.claude?.claudeMd) {
        const claudeMdPath = path.join(worktreePath, 'CLAUDE.md')
        await fs.writeFile(claudeMdPath, project.claude.claudeMd)
      }

      const exists = await this.containerService.imageExists(project.environment.baseImage)
      if (!exists) {
        await this.containerService.pullImage(project.environment.baseImage)
      }

      const mounts = [
        { source: worktreePath, target: '/workspace' },
        ...(project.mounts || []).map((m) => ({
          source: m.source.replace('~', process.env.HOME || ''),
          target: m.target,
          readonly: m.readonly,
        })),
      ]

      const ports = (project.environment.ports || []).map((p) => {
        const [container, host] = p.split(':').map(Number)
        return { container, host: host || undefined }
      })

      const containerInfo = await this.containerService.createContainer({
        name: `claude-sandbox-${session.id.slice(0, 8)}`,
        image: project.environment.baseImage,
        workdir: '/workspace',
        mounts,
        ports,
        env: project.environment.env,
      })

      await this.containerService.startContainer(containerInfo.id)
      this.sessionRepo.updateContainer(id, containerInfo.id, containerInfo.ports)

      if (project.setup) {
        logger.info('Running setup script', { sessionId: id })
        const result = await this.containerService.exec(containerInfo.id, ['bash', '/workspace/.claude-sandbox-setup.sh'])
        if (result.exitCode !== 0) {
          logger.warn('Setup script failed', { sessionId: id, exitCode: result.exitCode, output: result.output })
        }
      }

      const updated = this.sessionRepo.updateStatus(id, 'running')
      logger.info('Session started', { id, containerId: containerInfo.id })
      return updated!

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.sessionRepo.updateStatus(id, 'error', errorMessage)
      logger.error('Failed to start session', { id, error: errorMessage })
      throw error
    }
  }

  async stop(id: string): Promise<Session> {
    const session = this.sessionRepo.findById(id)
    if (!session) {
      throw new Error(`Session not found: ${id}`)
    }

    if (session.status === 'stopped') {
      return session
    }

    this.sessionRepo.updateStatus(id, 'stopping')

    try {
      if (session.container?.id) {
        await this.containerService.stopContainer(session.container.id)
      }

      const updated = this.sessionRepo.updateStatus(id, 'stopped')
      logger.info('Session stopped', { id })
      return updated!

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.sessionRepo.updateStatus(id, 'error', errorMessage)
      throw error
    }
  }

  async restart(id: string): Promise<Session> {
    await this.stop(id)
    return this.start(id)
  }

  async remove(id: string): Promise<void> {
    const session = this.sessionRepo.findById(id)
    if (!session) {
      throw new Error(`Session not found: ${id}`)
    }

    if (session.status === 'running' || session.status === 'starting') {
      await this.stop(id)
    }

    if (session.container?.id) {
      try {
        await this.containerService.removeContainer(session.container.id)
      } catch (error) {
        logger.warn('Failed to remove container', { id: session.container.id, error })
      }
    }

    if (session.worktree?.path) {
      const project = this.projectRepo.findById(session.projectId)
      if (project) {
        const repoPath = path.join(this.config.dataDir, 'repos', project.name)
        try {
          await this.gitService.removeWorktree(repoPath, session.worktree.path)
        } catch (error) {
          logger.warn('Failed to remove worktree', { path: session.worktree.path, error })
        }
      }
    }

    this.sessionRepo.delete(id)
    logger.info('Session removed', { id })
  }

  async getLogs(id: string): Promise<{ stdout: string; stderr: string }> {
    const session = this.sessionRepo.findById(id)
    if (!session) {
      throw new Error(`Session not found: ${id}`)
    }

    if (!session.container?.id) {
      return { stdout: '', stderr: '' }
    }

    return this.containerService.getLogs(session.container.id)
  }
}
