import Dockerode from 'dockerode'
import { logger } from '../logger.js'
import type { Config } from '../config.js'
import type {
  ProjectContainer,
  ContainerImage,
  ProjectNetwork,
  ProjectVolume,
  ContainerStats,
  ProjectResourceSummary,
  BatchOperationResult,
  ContainerState,
} from '@claude-sandbox/shared'

export interface ContainerCreateOptions {
  name: string
  image: string
  workdir: string
  mounts: Array<{
    source: string
    target: string
    readonly?: boolean
  }>
  ports?: Array<{
    container: number
    host?: number
  }>
  env?: Record<string, string>
  command?: string[]
  user?: string  // Run container as this user (UID:GID format, e.g., "1006:1007")
}

export interface ContainerInfo {
  id: string
  name: string
  status: string
  ports: Record<number, number>
}

export class ContainerService {
  private docker: Dockerode

  constructor(private config: Config) {
    const socketPath = config.containerSocket

    this.docker = new Dockerode({ socketPath })
    logger.info('ContainerService initialized', { runtime: config.containerRuntime, socketPath })
  }

  /**
   * Cleanup all claude-sandbox containers at startup (orphaned from previous runs)
   */
  async cleanupOrphanedContainers(): Promise<void> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: { name: ['claude-sandbox'] }
      })

      for (const containerInfo of containers) {
        // Remove ALL claude-sandbox containers at startup - they're from previous server runs
        try {
          const container = this.docker.getContainer(containerInfo.Id)
          await container.remove({ force: true })
          logger.info('Cleaned up orphaned container', {
            id: containerInfo.Id.slice(0, 12),
            name: containerInfo.Names[0],
            state: containerInfo.State
          })
        } catch (err) {
          logger.debug('Failed to cleanup container', { id: containerInfo.Id, error: err })
        }
      }

      // Also cleanup orphaned networks
      const networks = await this.docker.listNetworks({ filters: { name: ['claude-sandbox'] } })
      for (const networkInfo of networks) {
        try {
          const network = this.docker.getNetwork(networkInfo.Id)
          await network.remove()
          logger.info('Cleaned up orphaned network', { id: networkInfo.Id.slice(0, 12), name: networkInfo.Name })
        } catch (err) {
          logger.debug('Failed to cleanup network', { id: networkInfo.Id, error: err })
        }
      }
    } catch (err) {
      logger.warn('Failed to cleanup orphaned containers', { error: err })
    }
  }

  async pullImage(image: string): Promise<void> {
    logger.info('Pulling image', { image })

    const stream = await this.docker.pull(image)

    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err: Error | null) => err ? reject(err) : resolve(),
        (event: unknown) => logger.debug('Pull progress', event as Record<string, unknown>)
      )
    })

    logger.info('Image pulled', { image })
  }

  async imageExists(image: string): Promise<boolean> {
    try {
      await this.docker.getImage(image).inspect()
      return true
    } catch {
      return false
    }
  }

  async buildImage(contextPath: string, imageTag: string): Promise<void> {
    logger.info('Building image', { contextPath, imageTag })

    const stream = await this.docker.buildImage(
      { context: contextPath, src: ['Dockerfile'] },
      { t: imageTag }
    )

    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err: Error | null, result: unknown[]) => {
          if (err) {
            reject(err)
          } else {
            // Check for errors in the build output
            const lastMessage = result[result.length - 1] as { error?: string } | undefined
            if (lastMessage?.error) {
              reject(new Error(lastMessage.error))
            } else {
              resolve()
            }
          }
        },
        (event: { stream?: string; error?: string }) => {
          if (event.stream) {
            logger.debug('Build progress', { output: event.stream.trim() })
          }
          if (event.error) {
            logger.error('Build error', { error: event.error })
          }
        }
      )
    })

    logger.info('Image built', { imageTag })
  }

  async removeImage(imageTag: string): Promise<void> {
    try {
      const image = this.docker.getImage(imageTag)
      await image.remove({ force: true })
      logger.info('Image removed', { imageTag })
    } catch (err) {
      logger.warn('Failed to remove image', { imageTag, error: err })
    }
  }

  async createContainer(options: ContainerCreateOptions): Promise<ContainerInfo> {
    const portBindings: Record<string, Array<{ HostPort: string }>> = {}
    const exposedPorts: Record<string, object> = {}
    const assignedPorts: Record<number, number> = {}

    if (options.ports) {
      for (const port of options.ports) {
        const containerPort = `${port.container}/tcp`
        exposedPorts[containerPort] = {}
        // Use empty HostPort to let Docker/Podman assign a random available port
        portBindings[containerPort] = [{ HostPort: '' }]
        // We'll get the actual assigned port after container start from inspect
        assignedPorts[port.container] = 0  // Placeholder, will be updated after start
      }
    }

    // Add :z for SELinux relabeling (required on systems like AlmaLinux/RHEL)
    const binds = options.mounts.map((m) => {
      const flags = []
      if (m.readonly) flags.push('ro')
      flags.push('z')  // SELinux shared label
      return `${m.source}:${m.target}:${flags.join(',')}`
    })

    const envArray = options.env
      ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`)
      : []

    const container = await this.docker.createContainer({
      name: options.name,
      Image: options.image,
      WorkingDir: options.workdir,
      Cmd: options.command || ['sleep', 'infinity'],
      Env: envArray,
      ExposedPorts: exposedPorts,
      User: options.user,  // Run as specific UID:GID if provided
      HostConfig: {
        Binds: binds,
        PortBindings: portBindings,
        AutoRemove: false,
      },
      Tty: true,
      OpenStdin: true,
    })

    logger.info('Container created', { id: container.id, name: options.name })

    return {
      id: container.id,
      name: options.name,
      status: 'created',
      ports: assignedPorts,
    }
  }

  async startContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId)
    await container.start()
    logger.info('Container started', { id: containerId })
  }

  async stopContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId)
    await container.stop({ t: 10 })
    logger.info('Container stopped', { id: containerId })
  }

  async removeContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId)
    await container.remove({ force: true })
    logger.info('Container removed', { id: containerId })
  }

  async removeContainerByName(name: string): Promise<void> {
    try {
      const containers = await this.docker.listContainers({ all: true, filters: { name: [name] } })
      for (const containerInfo of containers) {
        // Exact name match (Docker adds / prefix)
        if (containerInfo.Names.some(n => n === `/${name}` || n === name)) {
          const container = this.docker.getContainer(containerInfo.Id)
          await container.remove({ force: true })
          logger.info('Container removed by name', { name, id: containerInfo.Id })
        }
      }
    } catch (err) {
      logger.debug('Failed to remove container by name', { name, error: err })
    }
  }

  async removeContainersByPrefix(prefix: string): Promise<void> {
    try {
      const containers = await this.docker.listContainers({ all: true, filters: { name: [prefix] } })
      for (const containerInfo of containers) {
        // Match any container whose name starts with the prefix
        if (containerInfo.Names.some(n => n.startsWith(`/${prefix}`) || n.startsWith(prefix))) {
          const container = this.docker.getContainer(containerInfo.Id)
          await container.remove({ force: true })
          logger.info('Container removed by prefix', { prefix, name: containerInfo.Names[0], id: containerInfo.Id })
        }
      }
    } catch (err) {
      logger.debug('Failed to remove containers by prefix', { prefix, error: err })
    }
  }

  async getContainerInfo(containerId: string): Promise<ContainerInfo | null> {
    try {
      const container = this.docker.getContainer(containerId)
      const info = await container.inspect()

      const ports: Record<number, number> = {}
      const portBindings = info.NetworkSettings.Ports || {}

      for (const [containerPort, bindings] of Object.entries(portBindings)) {
        const bindingsArray = bindings as Array<{ HostPort: string }> | null
        if (bindingsArray && bindingsArray.length > 0) {
          const portNum = parseInt(containerPort.split('/')[0])
          ports[portNum] = parseInt(bindingsArray[0].HostPort)
        }
      }

      return {
        id: info.Id,
        name: info.Name.replace(/^\//, ''),
        status: info.State.Status,
        ports,
      }
    } catch {
      return null
    }
  }

  async getLogs(containerId: string, tail: number = 100): Promise<{ stdout: string; stderr: string }> {
    const container = this.docker.getContainer(containerId)
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    })

    const stdout: string[] = []
    const stderr: string[] = []

    const logString = logs.toString()
    for (const line of logString.split('\n')) {
      if (line.length > 8) {
        const streamType = line.charCodeAt(0)
        const content = line.slice(8)
        if (streamType === 1) {
          stdout.push(content)
        } else if (streamType === 2) {
          stderr.push(content)
        } else {
          stdout.push(line)
        }
      }
    }

    return { stdout: stdout.join('\n'), stderr: stderr.join('\n') }
  }

  async exec(containerId: string, command: string[]): Promise<{ exitCode: number; output: string }> {
    const container = this.docker.getContainer(containerId)

    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
    })

    const stream = await exec.start({ hijack: true, stdin: false })

    return new Promise((resolve) => {
      let output = ''

      stream.on('data', (chunk: Buffer) => {
        output += chunk.toString()
      })

      stream.on('end', async () => {
        const inspect = await exec.inspect()
        resolve({
          exitCode: inspect.ExitCode || 0,
          output,
        })
      })
    })
  }

  getExecStream(containerId: string): Promise<{ exec: Dockerode.Exec; stream: NodeJS.ReadWriteStream }> {
    return new Promise(async (resolve, reject) => {
      try {
        const container = this.docker.getContainer(containerId)

        // Use tmux for persistent terminal session that survives WebSocket reconnects
        // -A: attach to session if exists, create if not
        // -s claude: session name
        // Enable mouse support with OSC 52 clipboard (works with xterm.js)
        const tmuxConfig = `
set -g mouse on
set -g history-limit 50000
set -s set-clipboard on
set -as terminal-features ',xterm-256color:clipboard'
set -g allow-passthrough on
bind -T copy-mode MouseDragEnd1Pane send-keys -X copy-selection-and-cancel
bind -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-selection-and-cancel
`.trim()
        const exec = await container.exec({
          Cmd: ['bash', '-c', `cat > /tmp/.tmux.conf << 'TMUXCONF'\n${tmuxConfig}\nTMUXCONF\nexec tmux -f /tmp/.tmux.conf new-session -A -s claude bash -l`],
          AttachStdin: true,
          AttachStdout: true,
          AttachStderr: true,
          Tty: true,
        })

        const stream = await exec.start({
          hijack: true,
          stdin: true,
          Tty: true,
        })

        resolve({ exec, stream })
      } catch (err) {
        reject(err)
      }
    })
  }

  async createNetwork(name: string): Promise<string> {
    try {
      const network = await this.docker.createNetwork({
        Name: name,
        Driver: 'bridge',
      })
      logger.info('Network created', { name, id: network.id })
      return network.id
    } catch (err: unknown) {
      const error = err as { statusCode?: number }
      if (error.statusCode === 409) {
        logger.debug('Network already exists', { name })
        const networks = await this.docker.listNetworks({ filters: { name: [name] } })
        return networks[0]?.Id || name
      }
      throw err
    }
  }

  async removeNetwork(name: string): Promise<void> {
    try {
      const network = this.docker.getNetwork(name)
      await network.remove()
      logger.info('Network removed', { name })
    } catch (err) {
      logger.warn('Failed to remove network', { name, error: err })
    }
  }

  async connectToNetwork(containerId: string, networkName: string, alias?: string): Promise<void> {
    const network = this.docker.getNetwork(networkName)
    await network.connect({
      Container: containerId,
      EndpointConfig: alias ? { Aliases: [alias] } : undefined,
    })
    logger.debug('Container connected to network', { containerId, networkName, alias })
  }

  async createServiceContainer(options: {
    name: string
    image: string
    env?: Record<string, string>
    network?: string
    networkAlias?: string
  }): Promise<string> {
    const exists = await this.imageExists(options.image)
    if (!exists) {
      await this.pullImage(options.image)
    }

    const envArray = options.env
      ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`)
      : []

    const container = await this.docker.createContainer({
      name: options.name,
      Image: options.image,
      Env: envArray,
      HostConfig: {
        AutoRemove: false,
      },
    })

    if (options.network) {
      await this.connectToNetwork(container.id, options.network, options.networkAlias)
    }

    await container.start()
    logger.info('Service container started', { name: options.name, image: options.image })
    return container.id
  }

  async copyToContainer(containerId: string, sourcePath: string, destPath: string): Promise<void> {
    const container = this.docker.getContainer(containerId)
    const { pack } = await import('tar-stream')
    const { createReadStream, promises: fs } = await import('fs')
    const pathModule = await import('path')

    const stat = await fs.stat(sourcePath)
    const tarStream = pack()

    if (stat.isDirectory()) {
      const addDirectory = async (dirPath: string, basePath: string) => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = pathModule.join(dirPath, entry.name)
          const relativePath = pathModule.join(basePath, entry.name)
          if (entry.isDirectory()) {
            await addDirectory(fullPath, relativePath)
          } else {
            const content = await fs.readFile(fullPath)
            tarStream.entry({ name: relativePath, mode: 0o644 }, content)
          }
        }
      }
      await addDirectory(sourcePath, pathModule.basename(destPath))
      tarStream.finalize()
    } else {
      const content = await fs.readFile(sourcePath)
      tarStream.entry({ name: pathModule.basename(destPath), mode: 0o644 }, content)
      tarStream.finalize()
    }

    await container.putArchive(tarStream, { path: pathModule.dirname(destPath) })
    logger.info('Files copied to container', { containerId, sourcePath, destPath })
  }

  async waitForServiceReady(containerId: string, serviceType: string, maxWaitMs: number = 30000): Promise<boolean> {
    const startTime = Date.now()
    let checkCmd: string[]

    switch (serviceType) {
      case 'postgres':
        checkCmd = ['pg_isready', '-U', 'postgres']
        break
      case 'mysql':
        checkCmd = ['mysqladmin', 'ping', '-h', 'localhost', '--silent']
        break
      case 'redis':
        checkCmd = ['redis-cli', 'ping']
        break
      case 'mongodb':
        checkCmd = ['mongosh', '--eval', 'db.adminCommand("ping")', '--quiet']
        break
      default:
        return true
    }

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const result = await this.exec(containerId, checkCmd)
        if (result.exitCode === 0) {
          logger.info('Service is ready', { containerId, serviceType })
          return true
        }
      } catch {
        // Ignore errors during wait
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    logger.warn('Service readiness timeout', { containerId, serviceType, maxWaitMs })
    return false
  }

  async execSqlFile(containerId: string, serviceType: string, sqlFilePath: string, database?: string, user?: string, password?: string): Promise<{ exitCode: number; output: string }> {
    // Copy SQL file to container and execute it
    const containerSqlPath = '/tmp/init.sql'
    await this.copyToContainer(containerId, sqlFilePath, containerSqlPath)

    let cmd: string[]
    switch (serviceType) {
      case 'postgres':
        cmd = ['psql', '-U', user || 'postgres', '-d', database || 'app', '-f', containerSqlPath]
        break
      case 'mysql':
        cmd = ['bash', '-c', `mysql -u ${user || 'mysql'} -p${password || 'mysql'} ${database || 'app'} < ${containerSqlPath}`]
        break
      default:
        throw new Error(`SQL execution not supported for service type: ${serviceType}`)
    }

    const result = await this.exec(containerId, cmd)

    // Cleanup
    await this.exec(containerId, ['rm', '-f', containerSqlPath]).catch(() => {})

    return result
  }

  private async findAvailablePort(start: number = 30000, end: number = 40000): Promise<number> {
    // Check all containers (including stopped ones) to avoid port conflicts
    const containers = await this.docker.listContainers({ all: true })
    const usedPorts = new Set<number>()

    for (const container of containers) {
      for (const port of container.Ports || []) {
        if (port.PublicPort) {
          usedPorts.add(port.PublicPort)
        }
      }
    }

    // Find first available port not used by any container
    for (let port = start; port <= end; port++) {
      if (!usedPorts.has(port)) {
        return port
      }
    }

    throw new Error('No available ports')
  }

  // ==================== Project-Level Container Management ====================

  /**
   * List all containers belonging to a project
   */
  async listContainersByProject(projectId: string): Promise<ProjectContainer[]> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { name: [`claude-sandbox-${projectId}`] }
    })

    return containers.map(c => {
      const name = c.Names[0]?.replace(/^\//, '') || ''
      // Parse session ID from container name (format: claude-sandbox-{projectId}-{sessionId} or -svc-{service})
      const nameParts = name.split('-')
      const isService = nameParts.includes('svc')
      let sessionId: string | undefined
      let sessionName: string | undefined

      if (!isService && nameParts.length >= 4) {
        // Main container: claude-sandbox-{projectId}-{sessionId}
        sessionId = nameParts.slice(3).join('-')
      }

      const ports: Record<number, number> = {}
      for (const port of c.Ports || []) {
        if (port.PrivatePort && port.PublicPort) {
          ports[port.PrivatePort] = port.PublicPort
        }
      }

      return {
        id: c.Id,
        name,
        sessionId,
        sessionName,
        image: c.Image,
        state: c.State as ContainerState,
        status: c.Status,
        created: new Date(c.Created * 1000),
        ports,
        type: isService ? 'service' : 'main',
      } satisfies ProjectContainer
    })
  }

  /**
   * List all images used by a project
   */
  async listImagesByProject(projectName: string): Promise<ContainerImage[]> {
    const images = await this.docker.listImages({ all: true })

    // Filter images by project name pattern
    const projectImages = images.filter(img => {
      const tags = img.RepoTags || []
      return tags.some(tag =>
        tag.includes(`claude-sandbox-${projectName}`) ||
        tag.includes(`claude-sandbox/${projectName}`)
      )
    })

    // Get usage count for each image
    const containers = await this.docker.listContainers({ all: true })
    const imageUsage = new Map<string, number>()
    for (const c of containers) {
      const count = imageUsage.get(c.ImageID) || 0
      imageUsage.set(c.ImageID, count + 1)
    }

    return projectImages.map(img => ({
      id: img.Id,
      tags: img.RepoTags || [],
      size: img.Size,
      created: new Date(img.Created * 1000),
      projectId: projectName,
      usedByContainers: imageUsage.get(img.Id) || 0,
    } satisfies ContainerImage))
  }

  /**
   * List all networks used by a project
   */
  async listNetworksByProject(projectId: string): Promise<ProjectNetwork[]> {
    const networks = await this.docker.listNetworks({
      filters: { name: [`claude-sandbox-${projectId}`] }
    })

    const result: ProjectNetwork[] = []
    for (const net of networks) {
      // Get detailed info including connected containers
      const network = this.docker.getNetwork(net.Id)
      const info = await network.inspect()

      const containerIds = Object.keys(info.Containers || {})

      result.push({
        id: net.Id,
        name: net.Name,
        driver: net.Driver || 'bridge',
        scope: info.Scope || 'local',
        created: new Date(info.Created),
        containers: containerIds,
      })
    }

    return result
  }

  /**
   * List all volumes used by a project
   */
  async listVolumesByProject(projectId: string): Promise<ProjectVolume[]> {
    const volumesResponse = await this.docker.listVolumes({
      filters: { name: [`claude-sandbox-${projectId}`] }
    })

    const volumes = volumesResponse.Volumes || []

    // Find which containers use each volume
    const containers = await this.docker.listContainers({ all: true })
    const volumeUsage = new Map<string, string[]>()

    for (const c of containers) {
      for (const mount of c.Mounts || []) {
        if (mount.Name) {
          const users = volumeUsage.get(mount.Name) || []
          users.push(c.Id)
          volumeUsage.set(mount.Name, users)
        }
      }
    }

    return volumes.map(vol => ({
      id: vol.Name, // Volumes use name as ID
      name: vol.Name,
      driver: vol.Driver,
      mountpoint: vol.Mountpoint,
      created: new Date((vol as { CreatedAt?: string }).CreatedAt || Date.now()),
      usedByContainers: volumeUsage.get(vol.Name) || [],
    } satisfies ProjectVolume))
  }

  /**
   * Get real-time stats for a container
   */
  async getContainerStats(containerId: string): Promise<ContainerStats> {
    const container = this.docker.getContainer(containerId)
    const stats = await container.stats({ stream: false })

    // Calculate CPU percentage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
    const cpuCount = stats.cpu_stats.online_cpus || 1
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0

    // Memory stats
    const memoryUsage = stats.memory_stats.usage || 0
    const memoryLimit = stats.memory_stats.limit || 1
    const memoryPercent = (memoryUsage / memoryLimit) * 100

    // Network stats
    let networkRx = 0
    let networkTx = 0
    if (stats.networks) {
      for (const net of Object.values(stats.networks)) {
        networkRx += (net as { rx_bytes?: number }).rx_bytes || 0
        networkTx += (net as { tx_bytes?: number }).tx_bytes || 0
      }
    }

    // Block I/O stats
    let blockRead = 0
    let blockWrite = 0
    if (stats.blkio_stats?.io_service_bytes_recursive) {
      for (const entry of stats.blkio_stats.io_service_bytes_recursive) {
        if (entry.op === 'read' || entry.op === 'Read') blockRead += entry.value
        if (entry.op === 'write' || entry.op === 'Write') blockWrite += entry.value
      }
    }

    return {
      containerId,
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      memoryUsage,
      memoryLimit,
      memoryPercent: Math.round(memoryPercent * 100) / 100,
      networkRx,
      networkTx,
      blockRead,
      blockWrite,
      pids: stats.pids_stats?.current || 0,
    }
  }

  /**
   * Stop multiple containers in batch
   */
  async stopContainersBatch(ids: string[]): Promise<BatchOperationResult> {
    const succeeded: string[] = []
    const failed: Array<{ id: string; error: string }> = []

    await Promise.all(ids.map(async (id) => {
      try {
        await this.stopContainer(id)
        succeeded.push(id)
      } catch (err) {
        failed.push({ id, error: err instanceof Error ? err.message : String(err) })
      }
    }))

    return { succeeded, failed }
  }

  /**
   * Remove multiple containers in batch
   */
  async removeContainersBatch(ids: string[]): Promise<BatchOperationResult> {
    const succeeded: string[] = []
    const failed: Array<{ id: string; error: string }> = []

    await Promise.all(ids.map(async (id) => {
      try {
        await this.removeContainer(id)
        succeeded.push(id)
      } catch (err) {
        failed.push({ id, error: err instanceof Error ? err.message : String(err) })
      }
    }))

    return { succeeded, failed }
  }

  /**
   * Find containers that don't belong to any active session
   */
  async findOrphanedContainers(projectId: string, validSessionIds: string[]): Promise<ProjectContainer[]> {
    const containers = await this.listContainersByProject(projectId)

    return containers.filter(c => {
      // Service containers without session are considered orphaned if no main container exists
      if (c.type === 'service') {
        // Check if there's a corresponding main container
        const hasMainContainer = containers.some(
          main => main.type === 'main' && main.sessionId && c.name.includes(main.sessionId)
        )
        return !hasMainContainer
      }

      // Main containers are orphaned if their session ID is not in validSessionIds
      return c.sessionId && !validSessionIds.includes(c.sessionId)
    })
  }

  /**
   * Get summary of all project resources
   */
  async getProjectResourceSummary(projectId: string, projectName: string, validSessionIds: string[] = []): Promise<ProjectResourceSummary> {
    const [containers, images, networks, volumes] = await Promise.all([
      this.listContainersByProject(projectId),
      this.listImagesByProject(projectName),
      this.listNetworksByProject(projectId),
      this.listVolumesByProject(projectId),
    ])

    const runningContainers = containers.filter(c => c.state === 'running')
    const stoppedContainers = containers.filter(c => c.state !== 'running')
    const orphanedContainers = containers.filter(c => {
      if (c.type === 'service') return false
      return c.sessionId && !validSessionIds.includes(c.sessionId)
    })

    const unusedImages = images.filter(img => img.usedByContainers === 0)
    const totalImageSize = images.reduce((sum, img) => sum + img.size, 0)

    const totalVolumeSize = volumes.reduce((sum, vol) => sum + (vol.size || 0), 0)

    return {
      containers: {
        total: containers.length,
        running: runningContainers.length,
        stopped: stoppedContainers.length,
        orphaned: orphanedContainers.length,
      },
      images: {
        total: images.length,
        size: totalImageSize,
        unused: unusedImages.length,
      },
      networks: {
        total: networks.length,
      },
      volumes: {
        total: volumes.length,
        size: totalVolumeSize,
      },
    }
  }

  /**
   * Cleanup orphaned containers for a project
   */
  async cleanupOrphanedContainersByProject(projectId: string, validSessionIds: string[]): Promise<BatchOperationResult> {
    const orphaned = await this.findOrphanedContainers(projectId, validSessionIds)
    const ids = orphaned.map(c => c.id)
    return this.removeContainersBatch(ids)
  }

  /**
   * Remove an image by ID or tag
   */
  async removeImageById(imageId: string): Promise<void> {
    const image = this.docker.getImage(imageId)
    await image.remove({ force: true })
    logger.info('Image removed by ID', { imageId })
  }
}
