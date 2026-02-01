import Dockerode from 'dockerode'
import { logger } from '../logger.js'
import type { Config } from '../config.js'

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
    const socketPath = config.containerRuntime === 'podman'
      ? `/run/user/${process.getuid?.() || 1000}/podman/podman.sock`
      : '/var/run/docker.sock'

    this.docker = new Dockerode({ socketPath })
    logger.info('ContainerService initialized', { runtime: config.containerRuntime, socketPath })
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

  async createContainer(options: ContainerCreateOptions): Promise<ContainerInfo> {
    const portBindings: Record<string, Array<{ HostPort: string }>> = {}
    const exposedPorts: Record<string, object> = {}
    const assignedPorts: Record<number, number> = {}

    if (options.ports) {
      for (const port of options.ports) {
        const containerPort = `${port.container}/tcp`
        exposedPorts[containerPort] = {}

        const hostPort = port.host || await this.findAvailablePort()
        portBindings[containerPort] = [{ HostPort: String(hostPort) }]
        assignedPorts[port.container] = hostPort
      }
    }

    const binds = options.mounts.map((m) =>
      `${m.source}:${m.target}${m.readonly ? ':ro' : ''}`
    )

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

        const exec = await container.exec({
          Cmd: ['/bin/bash'],
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

  private async findAvailablePort(start: number = 10000, end: number = 20000): Promise<number> {
    const containers = await this.docker.listContainers()
    const usedPorts = new Set<number>()

    for (const container of containers) {
      for (const port of container.Ports || []) {
        if (port.PublicPort) {
          usedPorts.add(port.PublicPort)
        }
      }
    }

    for (let port = start; port <= end; port++) {
      if (!usedPorts.has(port)) {
        return port
      }
    }

    throw new Error('No available ports')
  }
}
