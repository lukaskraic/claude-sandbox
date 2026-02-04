import path from 'path'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { Session, CreateSessionInput, Project, ProjectService as ProjectServiceType } from '@claude-sandbox/shared'

const execAsync = promisify(exec)

/**
 * Get UID and GID for a system user
 */
async function getUserIds(username: string): Promise<{ uid: number; gid: number } | null> {
  try {
    const { stdout: uidOut } = await execAsync(`id -u ${username}`)
    const { stdout: gidOut } = await execAsync(`id -g ${username}`)
    return {
      uid: parseInt(uidOut.trim(), 10),
      gid: parseInt(gidOut.trim(), 10),
    }
  } catch {
    return null
  }
}
import { SessionRepository } from '../db/repositories/SessionRepository.js'
import { ProjectRepository } from '../db/repositories/ProjectRepository.js'
import { GitService } from './GitService.js'
import { ContainerService } from './ContainerService.js'
import { ImageBuilderService } from './ImageBuilderService.js'
import { logger } from '../logger.js'
import type { Config } from '../config.js'

export class SessionService {
  constructor(
    private sessionRepo: SessionRepository,
    private projectRepo: ProjectRepository,
    private gitService: GitService,
    private containerService: ContainerService,
    private imageBuilderService: ImageBuilderService,
    private config: Config
  ) {}

  /**
   * Sync session status with actual container status after server restart.
   * If container exists and is running -> session is running
   * If container exists but stopped -> session is stopped
   * If container doesn't exist -> session is stopped
   */
  async syncSessionsWithContainers(): Promise<void> {
    const sessions = await this.sessionRepo.findAll()
    let synced = 0

    for (const session of sessions) {
      const containerId = session.container?.id
      if (!containerId) continue

      const containerInfo = await this.containerService.getContainerInfo(containerId)

      if (containerInfo) {
        // Container exists - update session status based on container state
        const isRunning = containerInfo.status === 'running'
        const newStatus = isRunning ? 'running' : 'stopped'

        if (session.status !== newStatus) {
          this.sessionRepo.updateStatus(session.id, newStatus)
          logger.info('Synced session status with container', {
            sessionId: session.id,
            containerId,
            oldStatus: session.status,
            newStatus,
            containerStatus: containerInfo.status,
          })
          synced++
        }
      } else {
        // Container doesn't exist - mark session as stopped
        if (session.status === 'running' || session.status === 'starting') {
          this.sessionRepo.updateStatus(session.id, 'stopped')
          this.sessionRepo.updateContainerId(session.id, null)
          logger.info('Marked session as stopped (container not found)', {
            sessionId: session.id,
            containerId,
          })
          synced++
        }
      }
    }

    logger.info('Session sync complete', { total: sessions.length, synced })
  }

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

    // If container already exists, try to start it
    if (session.container?.id) {
      try {
        await this.containerService.startContainer(session.container.id)
        const updated = this.sessionRepo.updateStatus(id, 'running')
        logger.info('Session restarted (existing container)', { id, containerId: session.container.id })
        return updated!
      } catch (error) {
        // Container might have been removed, continue to create new one
        logger.warn('Failed to restart existing container, creating new one', { containerId: session.container.id })
      }
    }

    try {
      const repoPath = path.join(this.config.dataDir, 'repos', project.name)
      await this.gitService.cloneIfNeeded(project.git.remote, repoPath, project.git.defaultBranch)

      // Use session's specified branch, or create unique session branch based on project's default
      const userBranch = session.worktree?.branch
      const baseBranch = project.git.defaultBranch || 'main'
      const branch = userBranch || `session/${session.id.slice(0, 8)}`
      const worktreePath = path.join(this.config.worktreeBase, project.name, session.id)

      const commit = await this.gitService.createWorktree(repoPath, worktreePath, branch, baseBranch)
      this.sessionRepo.updateWorktree(id, worktreePath, branch, baseBranch, commit)

      // Note: setup script is run later via bash -c, not written to file

      if (project.claude?.claudeMd) {
        const claudeMdPath = path.join(worktreePath, 'CLAUDE.md')
        await fs.writeFile(claudeMdPath, project.claude.claudeMd)
      }

      // Generate .mcp.json if MCP servers are configured
      if (project.claude?.mcpServers && project.claude.mcpServers.length > 0) {
        const enabledServers = project.claude.mcpServers.filter(s => s.enabled)
        if (enabledServers.length > 0) {
          const mcpConfig: Record<string, { command: string; args: string[]; env?: Record<string, string> }> = {}
          for (const server of enabledServers) {
            mcpConfig[server.name] = {
              command: server.command,
              args: server.args,
              ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
            }
          }
          const mcpJsonPath = path.join(worktreePath, '.mcp.json')
          await fs.writeFile(mcpJsonPath, JSON.stringify({ mcpServers: mcpConfig }, null, 2))
          logger.info('Generated .mcp.json', { sessionId: id, servers: enabledServers.map(s => s.name) })
        }
      }

      // Add ACL permissions for container user while keeping server user access
      if (session.claudeSourceUser) {
        const userIds = await getUserIds(session.claudeSourceUser)
        if (userIds) {
          try {
            // Use ACL to grant rwx to container user without removing server user's access
            // -R = recursive, -m = modify ACL, rwX = read/write/execute(dirs only)
            // File owner (claude-sandbox) can set ACL without sudo
            await execAsync(`setfacl -Rm u:${userIds.uid}:rwX ${worktreePath}`)
            await execAsync(`setfacl -Rdm u:${userIds.uid}:rwX ${worktreePath}`)
            logger.info('Added ACL for container user on worktree', { sessionId: id, path: worktreePath, uid: userIds.uid })

            // Add ACL to entire .git directory in main repo
            // Git needs write access to: .git/objects/, .git/worktrees/, .git/refs/, etc.
            const gitDirPath = path.join(repoPath, '.git')
            await execAsync(`setfacl -Rm u:${userIds.uid}:rwX ${gitDirPath}`)
            await execAsync(`setfacl -Rdm u:${userIds.uid}:rwX ${gitDirPath}`)
            logger.info('Added ACL for container user on .git directory', { sessionId: id, path: gitDirPath, uid: userIds.uid })
          } catch (err) {
            logger.warn('Failed to add ACL for container user', { sessionId: id, error: err })
          }
        }
      }

      // Always build custom image - we need tmux, sudo, ripgrep etc. even for base images
      const imageTag = await this.imageBuilderService.getOrBuildImage(project)

      // Start service containers if defined
      const serviceResult = await this.startServiceContainers(session.id, project)
      const networkName = serviceResult.networkId ? `claude-sandbox-${session.id.slice(0, 8)}` : undefined

      // Build mounts list
      const mounts = [
        { source: worktreePath, target: '/workspace' },
        // Mount main repo .git directory so git worktree references work inside container
        // Worktree .git file contains absolute path to main repo's .git/worktrees/
        // NOT readonly - git needs to write lock files in .git/worktrees/{session}/
        { source: path.join(repoPath, '.git'), target: path.join(repoPath, '.git'), readonly: false },
        ...(project.mounts || []).map((m) => ({
          source: m.source.replace('~', process.env.HOME || ''),
          target: m.target,
          readonly: m.readonly,
        })),
      ]

      // Add .claude directory mount if user specified
      // Must use same path as on host because Claude Code stores absolute paths in config
      const claudeSourceUser = session.claudeSourceUser
      const claudeSourcePath = claudeSourceUser
        ? `/home/${claudeSourceUser}/.claude`
        : null
      const claudeUserHome = claudeSourceUser ? `/home/${claudeSourceUser}` : null

      if (claudeSourcePath && claudeUserHome) {
        try {
          await fs.access(claudeSourcePath)
          mounts.push({
            source: claudeSourcePath,
            target: claudeSourcePath,  // Same path in container - Claude has hardcoded absolute paths
            readonly: false,  // Claude Code needs write access for settings.local.json, state, etc.
          })
          logger.info('Mounting .claude directory', { sessionId: id, source: claudeSourcePath, target: claudeSourcePath })

          // Also mount .claude.json (Claude Code writes config here too)
          // Create the file on host if it doesn't exist, with proper ownership
          const claudeJsonPath = `${claudeUserHome}/.claude.json`
          try {
            await fs.access(claudeJsonPath)
          } catch {
            // File doesn't exist - create empty JSON file with proper ownership
            logger.info('Creating .claude.json on host', { sessionId: id, path: claudeJsonPath })
            await fs.writeFile(claudeJsonPath, '{}', { mode: 0o600 })
            // Change ownership to the claude source user
            const userIds = await getUserIds(claudeSourceUser!)
            if (userIds) {
              await execAsync(`chown ${userIds.uid}:${userIds.gid} ${claudeJsonPath}`)
            }
          }
          mounts.push({
            source: claudeJsonPath,
            target: claudeJsonPath,
            readonly: false,
          })
          logger.info('Mounting .claude.json', { sessionId: id, path: claudeJsonPath })

          // Mount .local directory (contains Claude Code binary in bin/)
          const localPath = `${claudeUserHome}/.local`
          try {
            await fs.access(localPath)
            mounts.push({
              source: localPath,
              target: localPath,
              readonly: false,  // Claude may need to update itself
            })
            logger.info('Mounting .local directory', { sessionId: id, source: localPath, target: localPath })
          } catch {
            logger.debug('.local directory not found, skipping mount', { sessionId: id, path: localPath })
          }

          // Mount .gitconfig only if session doesn't have git user settings
          // (if session has settings, startup command will set them via git config --global)
          if (!session.gitUserName && !session.gitUserEmail) {
            const gitconfigPath = `${claudeUserHome}/.gitconfig`
            try {
              await fs.access(gitconfigPath)
              mounts.push({
                source: gitconfigPath,
                target: gitconfigPath,
                readonly: true,
              })
              logger.info('Mounting .gitconfig (no session git settings)', { sessionId: id, path: gitconfigPath })
            } catch {
              logger.debug('.gitconfig not found, skipping mount', { sessionId: id, path: gitconfigPath })
            }
          } else {
            logger.info('Skipping .gitconfig mount (session has git settings)', { sessionId: id, gitUserName: session.gitUserName, gitUserEmail: session.gitUserEmail })
          }
        } catch (err) {
          logger.warn('.claude directory not accessible', { sessionId: id, path: claudeSourcePath, error: err })
        }
      }

      // Only use container port - host port is dynamically assigned per session
      // This allows multiple sessions from the same project to run simultaneously
      const ports = (project.environment.ports || []).map((p) => {
        const [container] = p.split(':').map(Number)
        return { container }
      })

      // Clean up any orphaned container with same name from failed previous start
      const mainContainerName = `claude-sandbox-${session.id.slice(0, 8)}`
      await this.containerService.removeContainerByName(mainContainerName).catch(() => {})

      // Build environment with HOME and PATH set to match the claude source user
      const containerEnv = {
        ...project.environment.env,
        ...serviceResult.env,
        ...(claudeUserHome ? {
          HOME: claudeUserHome,
          // Prepend ~/.local/bin to PATH for Claude Code binary
          PATH: `${claudeUserHome}/.local/bin:/usr/lib/jvm/java/bin:/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
        } : {}),
      }

      // Get UID/GID of the claude source user to run container with same permissions
      let containerUser: string | undefined
      if (claudeSourceUser) {
        const userIds = await getUserIds(claudeSourceUser)
        if (userIds) {
          containerUser = `${userIds.uid}:${userIds.gid}`
          logger.info('Running container as user', { sessionId: id, user: containerUser })
        } else {
          logger.warn('Could not get UID/GID for user, running as root', { sessionId: id, user: claudeSourceUser })
        }
      }

      // Build startup command - setup git config, safe.directory, PATH, then sleep
      let startupCommand: string[] | undefined
      if (claudeUserHome) {
        const gitRepoPath = path.join(repoPath, '.git')
        // First ensure home directory is writable (use sudo to chown if needed)
        // Then set git config --global (writes to $HOME/.gitconfig)
        const setupCommands: string[] = [
          // Make home directory writable by container user
          `sudo chown $(id -u):$(id -g) ${claudeUserHome} 2>/dev/null || true`,
          // Git safe.directory settings
          `git config --global --add safe.directory /workspace`,
          `git config --global --add safe.directory ${gitRepoPath}`,
          // Convert SSH remote to HTTPS (SSH is blocked in sandbox)
          `cd /workspace && git remote get-url origin 2>/dev/null | grep -q '^git@github.com:' && git remote set-url origin $(git remote get-url origin | sed 's|git@github.com:|https://github.com/|') || true`,
        ]
        // Add git user config if provided in session
        if (session.gitUserName) {
          setupCommands.push(`git config --global user.name "${session.gitUserName.replace(/"/g, '\\"')}"`)
        }
        if (session.gitUserEmail) {
          setupCommands.push(`git config --global user.email "${session.gitUserEmail.replace(/"/g, '\\"')}"`)
        }

        startupCommand = [
          'sh', '-c',
          `${setupCommands.join('; ')}; exec sleep infinity`
        ]
      }

      const containerInfo = await this.containerService.createContainer({
        name: mainContainerName,
        image: imageTag,
        workdir: '/workspace',
        mounts,
        ports,
        env: containerEnv,
        user: containerUser,
        command: startupCommand,
      })

      await this.containerService.startContainer(containerInfo.id)

      // Connect main container to service network
      if (networkName) {
        await this.containerService.connectToNetwork(containerInfo.id, networkName, 'app')
      }

      // Get actual assigned ports after container start
      const actualContainerInfo = await this.containerService.getContainerInfo(containerInfo.id)
      const actualPorts = actualContainerInfo?.ports || containerInfo.ports

      this.sessionRepo.updateContainer(
        id,
        containerInfo.id,
        actualPorts,
        serviceResult.containerIds.length > 0 ? serviceResult.containerIds : undefined,
        serviceResult.networkId
      )


      // Wait for service containers to be ready and run init SQL from file
      if (serviceResult.containerIds.length > 0 && project.environment.services) {
        for (let i = 0; i < project.environment.services.length; i++) {
          const service = project.environment.services[i]
          const containerId = serviceResult.containerIds[i]

          if (!containerId) continue

          // Wait for service to be ready
          await this.containerService.waitForServiceReady(containerId, service.type)

          // Run init SQL file if defined
          if (service.initSqlFile && (service.type === 'postgres' || service.type === 'mysql')) {
            // Check if it's an uploaded file (starts with "uploads/") or worktree file
            const sqlFilePath = service.initSqlFile.startsWith('uploads/')
              ? path.join(this.config.dataDir, service.initSqlFile)
              : path.join(worktreePath, service.initSqlFile)
            logger.info('Running init SQL from file', { sessionId: id, service: service.type, file: sqlFilePath })
            try {
              // Check if file exists
              await fs.access(sqlFilePath)

              // Copy SQL file to service container and execute
              const sqlResult = await this.containerService.execSqlFile(
                containerId,
                service.type,
                sqlFilePath,
                service.database,
                service.user,
                service.password
              )
              if (sqlResult.exitCode !== 0) {
                logger.warn('Init SQL failed', { sessionId: id, service: service.type, exitCode: sqlResult.exitCode, output: sqlResult.output.slice(0, 1000) })
              } else {
                logger.info('Init SQL completed', { sessionId: id, service: service.type })
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error)
              logger.warn('Failed to run init SQL file', { sessionId: id, service: service.type, file: sqlFilePath, error: errorMsg })
            }
          }
        }
      }

      if (project.environment.setup) {
        logger.info('Running setup script', { sessionId: id })
        const result = await this.containerService.exec(containerInfo.id, ['bash', '-c', project.environment.setup])
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

      // Cleanup any containers/networks created before the failure (by name pattern)
      const sessionPrefix = `claude-sandbox-${id.slice(0, 8)}`
      await this.containerService.removeContainersByPrefix(sessionPrefix).catch(err => {
        logger.warn('Failed to cleanup containers after session start error', { id, error: err })
      })
      await this.containerService.removeNetwork(sessionPrefix).catch(err => {
        logger.warn('Failed to cleanup network after session start error', { id, error: err })
      })

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

  /**
   * Mark session as stopped without trying to stop containers
   * Used when container no longer exists (e.g., after backend restart)
   */
  async markStopped(id: string): Promise<Session | null> {
    const session = this.sessionRepo.findById(id)
    if (!session) {
      return null
    }

    if (session.status === 'stopped') {
      return session
    }

    const updated = this.sessionRepo.updateStatus(id, 'stopped')
    logger.info('Session marked as stopped (container missing)', { id })
    return updated
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

    // Clean up service containers and network
    await this.cleanupServiceContainers(session)

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

  private async startServiceContainers(
    sessionId: string,
    project: { id: string; name: string; environment: { services?: Array<{ type: string; version: string; database?: string; user?: string; password?: string }> } }
  ): Promise<{ env: Record<string, string>; containerIds: string[]; networkId?: string }> {
    const services = project.environment.services
    if (!services || services.length === 0) {
      return { env: {}, containerIds: [] }
    }

    const networkName = `claude-sandbox-${sessionId.slice(0, 8)}`
    const networkId = await this.containerService.createNetwork(networkName)

    const containerIds: string[] = []
    const env: Record<string, string> = {}

    for (const service of services) {
      const containerName = `${networkName}-${service.type}`
      const alias = service.type

      let image: string
      let serviceEnv: Record<string, string> = {}

      switch (service.type) {
        case 'postgres':
          image = `postgres:${service.version}`
          serviceEnv = {
            POSTGRES_DB: service.database || 'app',
            POSTGRES_USER: service.user || 'postgres',
            POSTGRES_PASSWORD: service.password || 'postgres',
          }
          env.DATABASE_URL = `postgresql://${serviceEnv.POSTGRES_USER}:${serviceEnv.POSTGRES_PASSWORD}@${alias}:5432/${serviceEnv.POSTGRES_DB}`
          env.POSTGRES_HOST = alias
          env.POSTGRES_PORT = '5432'
          env.POSTGRES_DB = serviceEnv.POSTGRES_DB
          env.POSTGRES_USER = serviceEnv.POSTGRES_USER
          env.POSTGRES_PASSWORD = serviceEnv.POSTGRES_PASSWORD
          break

        case 'mysql':
          image = `mysql:${service.version}`
          serviceEnv = {
            MYSQL_DATABASE: service.database || 'app',
            MYSQL_USER: service.user || 'mysql',
            MYSQL_PASSWORD: service.password || 'mysql',
            MYSQL_ROOT_PASSWORD: service.password || 'mysql',
          }
          env.DATABASE_URL = `mysql://${serviceEnv.MYSQL_USER}:${serviceEnv.MYSQL_PASSWORD}@${alias}:3306/${serviceEnv.MYSQL_DATABASE}`
          env.MYSQL_HOST = alias
          env.MYSQL_PORT = '3306'
          env.MYSQL_DATABASE = serviceEnv.MYSQL_DATABASE
          env.MYSQL_USER = serviceEnv.MYSQL_USER
          env.MYSQL_PASSWORD = serviceEnv.MYSQL_PASSWORD
          break

        case 'redis':
          image = `redis:${service.version}`
          env.REDIS_URL = `redis://${alias}:6379`
          env.REDIS_HOST = alias
          env.REDIS_PORT = '6379'
          break

        case 'mongodb':
          image = `mongo:${service.version}`
          serviceEnv = {
            MONGO_INITDB_DATABASE: service.database || 'app',
          }
          if (service.user && service.password) {
            serviceEnv.MONGO_INITDB_ROOT_USERNAME = service.user
            serviceEnv.MONGO_INITDB_ROOT_PASSWORD = service.password
            env.MONGODB_URL = `mongodb://${service.user}:${service.password}@${alias}:27017/${serviceEnv.MONGO_INITDB_DATABASE}`
          } else {
            env.MONGODB_URL = `mongodb://${alias}:27017/${serviceEnv.MONGO_INITDB_DATABASE}`
          }
          env.MONGODB_HOST = alias
          env.MONGODB_PORT = '27017'
          break

        case 'elasticsearch':
          image = `elasticsearch:${service.version}`
          serviceEnv = {
            'discovery.type': 'single-node',
            'xpack.security.enabled': 'false',
          }
          env.ELASTICSEARCH_URL = `http://${alias}:9200`
          env.ELASTICSEARCH_HOST = alias
          env.ELASTICSEARCH_PORT = '9200'
          break

        default:
          logger.warn('Unknown service type', { type: service.type })
          continue
      }

      try {
        // Try to remove existing container with same name (from failed previous start)
        await this.containerService.removeContainerByName(containerName).catch(() => {})

        const containerId = await this.containerService.createServiceContainer({
          name: containerName,
          image,
          env: serviceEnv,
          network: networkName,
          networkAlias: alias,
        })
        containerIds.push(containerId)
        logger.info('Service container started', { sessionId, service: service.type, containerId })
      } catch (error) {
        logger.error('Failed to start service container', { sessionId, service: service.type, error })
        throw error
      }
    }

    return { env, containerIds, networkId }
  }

  private async cleanupServiceContainers(session: { container?: { serviceContainers?: string[]; networkId?: string } }): Promise<void> {
    if (!session.container) return

    const { serviceContainers, networkId } = session.container

    if (serviceContainers) {
      for (const containerId of serviceContainers) {
        try {
          await this.containerService.removeContainer(containerId)
        } catch (error) {
          logger.warn('Failed to remove service container', { containerId, error })
        }
      }
    }

    if (networkId) {
      await this.containerService.removeNetwork(networkId)
    }
  }
}
