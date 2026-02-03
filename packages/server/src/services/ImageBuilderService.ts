import crypto from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import type { ProjectEnvironment, ProjectImage, Project } from '@claude-sandbox/shared'
import { ProjectImageRepository } from '../db/repositories/ProjectImageRepository.js'
import { ContainerService } from './ContainerService.js'
import { logger } from '../logger.js'

export class ImageBuilderService {
  constructor(
    private imageRepo: ProjectImageRepository,
    private containerService: ContainerService,
    private buildDir: string
  ) {}

  /**
   * Get or build a cached image for a project
   */
  async getOrBuildImage(project: Project): Promise<string> {
    const configHash = this.hashEnvironmentConfig(project.environment)
    const imageTag = `claude-sandbox/${project.name}:${configHash.slice(0, 12)}`

    // Check if we have a cached image with this config
    const cached = this.imageRepo.findByConfigHash(project.id, configHash)
    if (cached && cached.status === 'ready') {
      // Verify image still exists
      const exists = await this.containerService.imageExists(imageTag)
      if (exists) {
        logger.info('Using cached image', { projectId: project.id, imageTag })
        return imageTag
      }
    }

    // Need to build a new image
    logger.info('Building new image', { projectId: project.id, imageTag })
    const imageRecord = this.imageRepo.create(project.id, imageTag, configHash)

    try {
      await this.buildImage(project, imageTag)
      this.imageRepo.updateStatus(imageRecord.id, 'ready')
      logger.info('Image built successfully', { projectId: project.id, imageTag })
      return imageTag
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      this.imageRepo.updateStatus(imageRecord.id, 'failed', errorMsg)
      logger.error('Image build failed', { projectId: project.id, error: errorMsg })
      throw err
    }
  }

  /**
   * Force rebuild image for a project
   */
  async rebuildImage(project: Project): Promise<string> {
    // Get old image tag before deleting
    const oldImage = this.imageRepo.findByProjectId(project.id)

    // Delete DB record
    this.imageRepo.deleteByProjectId(project.id)

    // Delete actual Docker image if it exists
    if (oldImage?.imageTag) {
      await this.containerService.removeImage(oldImage.imageTag)
    }

    return this.getOrBuildImage(project)
  }

  /**
   * Get current image status for a project
   */
  getImageStatus(projectId: string): ProjectImage | null {
    return this.imageRepo.findByProjectId(projectId)
  }

  /**
   * Generate Dockerfile content from project environment config
   */
  generateDockerfile(env: ProjectEnvironment): string {
    const lines: string[] = []

    // Base image
    lines.push(`FROM ${env.baseImage}`)
    lines.push('')

    // Set non-interactive mode for apt
    lines.push('ENV DEBIAN_FRONTEND=noninteractive')
    lines.push('')

    // Get proxy settings - prefer project config, fallback to env vars
    const httpProxy = env.proxy?.http || process.env.HTTP_PROXY || process.env.http_proxy
    const httpsProxy = env.proxy?.https || process.env.HTTPS_PROXY || process.env.https_proxy
    const noProxy = env.proxy?.noProxy || process.env.NO_PROXY || process.env.no_proxy

    // Add proxy settings if available
    if (httpProxy || httpsProxy) {
      lines.push('# Proxy settings - ENV vars')
      if (httpProxy) {
        lines.push(`ENV HTTP_PROXY=${httpProxy}`)
        lines.push(`ENV http_proxy=${httpProxy}`)
      }
      if (httpsProxy) {
        lines.push(`ENV HTTPS_PROXY=${httpsProxy}`)
        lines.push(`ENV https_proxy=${httpsProxy}`)
      }
      if (noProxy) {
        lines.push(`ENV NO_PROXY=${noProxy}`)
        lines.push(`ENV no_proxy=${noProxy}`)
      }
      lines.push('')

      // Configure apt to use proxy (required for apt-get)
      lines.push('# Configure apt proxy')
      lines.push('RUN mkdir -p /etc/apt/apt.conf.d && \\')
      const aptConfLines: string[] = []
      if (httpProxy) {
        aptConfLines.push(`echo 'Acquire::http::Proxy "${httpProxy}";'`)
      }
      if (httpsProxy) {
        aptConfLines.push(`echo 'Acquire::https::Proxy "${httpsProxy}";'`)
      }
      lines.push(`    (${aptConfLines.join(' && ')}) > /etc/apt/apt.conf.d/99proxy`)
      lines.push('')
    }

    // Install system packages (including sudo for non-root user support, ripgrep for Claude Code)
    const systemPackages = ['curl', 'git', 'ca-certificates', 'tmux', 'sudo', 'ripgrep', ...(env.packages || [])]

    // Add database clients if services are configured
    if (env.services) {
      for (const service of env.services) {
        switch (service.type) {
          case 'postgres':
            systemPackages.push('postgresql-client')
            break
          case 'mysql':
            systemPackages.push('default-mysql-client')
            break
          case 'redis':
            systemPackages.push('redis-tools')
            break
          case 'mongodb':
            // MongoDB client needs special installation, skip for now
            break
        }
      }
    }
    lines.push('RUN apt-get update && apt-get install -y \\')
    lines.push(`    ${systemPackages.join(' \\\n    ')} \\`)
    lines.push('    && rm -rf /var/lib/apt/lists/*')
    lines.push('')

    // Install GitHub CLI (gh)
    lines.push('# Install GitHub CLI')
    lines.push('RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \\')
    lines.push('    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \\')
    lines.push('    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \\')
    lines.push('    && apt-get update && apt-get install -y gh \\')
    lines.push('    && rm -rf /var/lib/apt/lists/*')
    lines.push('')

    // Allow passwordless sudo for all users (sandbox environment)
    lines.push('# Allow passwordless sudo for any user (sandboxed environment)')
    lines.push('RUN echo "ALL ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers')
    lines.push('')

    // Check if npm tools are needed
    const needsNpm = (env.tools?.npm && env.tools.npm.length > 0) ||
                     (env.tools?.custom && env.tools.custom.includes('claude-code'))
    const needsJava = !!env.runtimes?.java

    // Install runtimes
    if (env.runtimes) {
      if (env.runtimes.java) {
        lines.push(`# Install Java ${env.runtimes.java}`)
        lines.push(`RUN curl -fsSL https://download.oracle.com/java/${env.runtimes.java}/latest/jdk-${env.runtimes.java}_linux-x64_bin.tar.gz -o /tmp/jdk.tar.gz \\`)
        lines.push('    && mkdir -p /usr/lib/jvm \\')
        lines.push('    && tar -xzf /tmp/jdk.tar.gz -C /usr/lib/jvm \\')
        lines.push('    && rm /tmp/jdk.tar.gz \\')
        lines.push(`    && ln -s /usr/lib/jvm/jdk-${env.runtimes.java}* /usr/lib/jvm/java`)
        lines.push('ENV JAVA_HOME=/usr/lib/jvm/java')
        lines.push('ENV PATH="$JAVA_HOME/bin:$PATH"')
        lines.push('')
      }

      if (env.runtimes.node) {
        lines.push(`# Install Node.js ${env.runtimes.node}`)
        lines.push(`RUN curl -fsSL https://deb.nodesource.com/setup_${env.runtimes.node}.x | bash - \\`)
        lines.push('    && apt-get install -y nodejs \\')
        lines.push('    && rm -rf /var/lib/apt/lists/*')
        lines.push('')
      }

      if (env.runtimes.python) {
        lines.push(`# Install Python ${env.runtimes.python}`)
        lines.push('RUN apt-get update && apt-get install -y \\')
        lines.push(`    python${env.runtimes.python} python3-pip python3-venv \\`)
        lines.push('    && rm -rf /var/lib/apt/lists/* \\')
        lines.push(`    && ln -sf /usr/bin/python${env.runtimes.python} /usr/bin/python`)
        lines.push('')
      }

      if (env.runtimes.go) {
        lines.push(`# Install Go ${env.runtimes.go}`)
        lines.push(`RUN curl -fsSL https://go.dev/dl/go${env.runtimes.go}.linux-amd64.tar.gz -o /tmp/go.tar.gz \\`)
        lines.push('    && tar -C /usr/local -xzf /tmp/go.tar.gz \\')
        lines.push('    && rm /tmp/go.tar.gz')
        lines.push('ENV PATH="/usr/local/go/bin:$PATH"')
        lines.push('')
      }
    }

    // Auto-install Node.js if npm tools are needed but no Node runtime specified
    if (needsNpm && !env.runtimes?.node) {
      lines.push('# Auto-install Node.js 20 (required for npm tools)')
      lines.push('RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \\')
      lines.push('    && apt-get install -y nodejs \\')
      lines.push('    && rm -rf /var/lib/apt/lists/*')
      lines.push('')
    }

    // Configure npm proxy if needed (after Node.js is installed)
    if (needsNpm && (httpProxy || httpsProxy)) {
      lines.push('# Configure npm proxy')
      const npmProxyCommands: string[] = []
      if (httpProxy) npmProxyCommands.push(`npm config set proxy ${httpProxy}`)
      if (httpsProxy) npmProxyCommands.push(`npm config set https-proxy ${httpsProxy}`)
      lines.push(`RUN ${npmProxyCommands.join(' && ')}`)
      lines.push('')
    }

    // Install tools
    if (env.tools) {
      if (env.tools.npm && env.tools.npm.length > 0) {
        lines.push('# Install NPM global packages')
        lines.push(`RUN npm install -g ${env.tools.npm.join(' ')}`)
        lines.push('')
      }

      if (env.tools.pip && env.tools.pip.length > 0) {
        lines.push('# Install Python packages')
        lines.push(`RUN pip install ${env.tools.pip.join(' ')}`)
        lines.push('')
      }

      if (env.tools.custom && env.tools.custom.includes('claude-code')) {
        lines.push('# Install Claude Code CLI')
        lines.push('RUN npm install -g @anthropic-ai/claude-code')
        lines.push('')
      }
    }

    // Note: env.setup is NOT included in Dockerfile - it runs at session start
    // when the worktree is mounted (handled by SessionService)

    // Configure Maven/Java proxy if Java is installed
    if (needsJava && (httpProxy || httpsProxy)) {
      lines.push('# Configure Maven proxy via settings.xml')
      const proxyUrl = new URL(httpsProxy || httpProxy || '')
      const proxyHost = proxyUrl.hostname
      const proxyPort = proxyUrl.port || '8080'

      // Build nonProxyHosts - include common Docker service hostnames
      const dockerServices = ['postgres', 'mysql', 'redis', 'mongodb', 'rabbitmq', 'elasticsearch']
      const baseNonProxy = noProxy || 'localhost,127.0.0.1'
      const allNonProxyHosts = [...baseNonProxy.split(','), ...dockerServices]
      const mavenNonProxyHosts = allNonProxyHosts.join('|')
      const javaNonProxyHosts = allNonProxyHosts.join('|')

      // Create Maven settings.xml with proxy
      lines.push('RUN mkdir -p /root/.m2 && \\')
      lines.push(`    echo '<?xml version="1.0" encoding="UTF-8"?>\\n<settings>\\n  <proxies>\\n    <proxy>\\n      <id>http-proxy</id>\\n      <active>true</active>\\n      <protocol>http</protocol>\\n      <host>${proxyHost}</host>\\n      <port>${proxyPort}</port>\\n      <nonProxyHosts>${mavenNonProxyHosts}</nonProxyHosts>\\n    </proxy>\\n    <proxy>\\n      <id>https-proxy</id>\\n      <active>true</active>\\n      <protocol>https</protocol>\\n      <host>${proxyHost}</host>\\n      <port>${proxyPort}</port>\\n      <nonProxyHosts>${mavenNonProxyHosts}</nonProxyHosts>\\n    </proxy>\\n  </proxies>\\n</settings>' > /root/.m2/settings.xml`)
      lines.push('')

      // Also set JAVA_TOOL_OPTIONS for other Java tools (including nonProxyHosts)
      lines.push('# Configure Java proxy via JAVA_TOOL_OPTIONS')
      lines.push(`ENV JAVA_TOOL_OPTIONS="-Dhttp.proxyHost=${proxyHost} -Dhttp.proxyPort=${proxyPort} -Dhttps.proxyHost=${proxyHost} -Dhttps.proxyPort=${proxyPort} -Dhttp.nonProxyHosts=${javaNonProxyHosts}"`)
      lines.push('')
    }

    // Add proxy settings to bashrc for interactive sessions
    if (httpProxy || httpsProxy) {
      lines.push('# Add proxy to bashrc for interactive sessions')
      const bashrcLines: string[] = []
      if (httpProxy) {
        bashrcLines.push(`export HTTP_PROXY=${httpProxy}`)
        bashrcLines.push(`export http_proxy=${httpProxy}`)
      }
      if (httpsProxy) {
        bashrcLines.push(`export HTTPS_PROXY=${httpsProxy}`)
        bashrcLines.push(`export https_proxy=${httpsProxy}`)
      }
      if (noProxy) {
        bashrcLines.push(`export NO_PROXY=${noProxy}`)
        bashrcLines.push(`export no_proxy=${noProxy}`)
      }
      lines.push(`RUN echo '${bashrcLines.join('\\n')}' >> /etc/bash.bashrc`)
      lines.push('')
    }

    // Set workdir
    lines.push('WORKDIR /workspace')
    lines.push('')

    // Default command
    lines.push('CMD ["sleep", "infinity"]')

    return lines.join('\n')
  }

  /**
   * Build Docker image from project config
   */
  private async buildImage(project: Project, imageTag: string): Promise<void> {
    const buildPath = path.join(this.buildDir, project.id)
    await fs.mkdir(buildPath, { recursive: true })

    const dockerfile = this.generateDockerfile(project.environment)
    const dockerfilePath = path.join(buildPath, 'Dockerfile')
    await fs.writeFile(dockerfilePath, dockerfile)

    logger.debug('Generated Dockerfile', { path: dockerfilePath, content: dockerfile })

    await this.containerService.buildImage(buildPath, imageTag)

    // Cleanup
    await fs.rm(buildPath, { recursive: true, force: true })
  }

  /**
   * Hash environment config for cache key
   */
  private hashEnvironmentConfig(env: ProjectEnvironment): string {
    const normalized = JSON.stringify(env, Object.keys(env).sort())
    return crypto.createHash('sha256').update(normalized).digest('hex')
  }
}
