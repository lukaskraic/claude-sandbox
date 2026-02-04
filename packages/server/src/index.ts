import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'path'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import * as trpcExpress from '@trpc/server/adapters/express'
import { loadConfig } from './config.js'
import { logger } from './logger.js'
import { getDatabase } from './db/database.js'
import { ProjectRepository } from './db/repositories/ProjectRepository.js'
import { SessionRepository } from './db/repositories/SessionRepository.js'
import { ProjectImageRepository } from './db/repositories/ProjectImageRepository.js'
import { ProjectService } from './services/ProjectService.js'
import { SessionService } from './services/SessionService.js'
import { GitService } from './services/GitService.js'
import { ContainerService } from './services/ContainerService.js'
import { ImageBuilderService } from './services/ImageBuilderService.js'
import { AuthService } from './services/AuthService.js'
import { appRouter } from './trpc/router.js'
import { createContextFactory } from './trpc/context.js'
import { createTerminalHandler } from './ws/terminalHandler.js'
import { createUploadRouter } from './api/uploads.js'
import { createProxyRouter, createProxyWebSocketHandler } from './api/proxy.js'
import { requireAuth, checkWebSocketAuth } from './middleware/auth.js'
import { promises as fs } from 'fs'
import { execFileSync } from 'child_process'

async function main() {
  const config = loadConfig()
  logger.setLevel(config.logLevel)

  await fs.mkdir(config.dataDir, { recursive: true })
  await fs.mkdir(config.worktreeBase, { recursive: true })

  // Configure git to allow operations on directories owned by other users
  // This is needed because worktrees may be owned by session users (different UID)
  try {
    execFileSync('git', ['config', '--global', '--add', 'safe.directory', '*'], { stdio: 'ignore' })
    logger.info('Configured git safe.directory for all paths')
  } catch (err) {
    logger.warn('Failed to configure git safe.directory', { error: err })
  }

  const dbPath = path.join(config.dataDir, 'claude-sandbox.db')
  const db = getDatabase(dbPath)

  const projectRepo = new ProjectRepository(db)
  const sessionRepo = new SessionRepository(db)
  const projectImageRepo = new ProjectImageRepository(db)

  const gitService = new GitService()
  const containerService = new ContainerService(config)

  // Don't cleanup containers at startup - they should persist across server restarts
  // Instead, sync session status with container status after SessionService is created

  const imageBuilderService = new ImageBuilderService(
    projectImageRepo,
    containerService,
    path.join(config.dataDir, 'builds')
  )
  const projectService = new ProjectService(projectRepo)
  const sessionService = new SessionService(
    sessionRepo,
    projectRepo,
    gitService,
    containerService,
    imageBuilderService,
    config
  )

  // Sync session status with actual container status after restart
  await sessionService.syncSessionsWithContainers()

  const authService = new AuthService(db, config)

  const services = { projectService, sessionService, gitService, containerService, imageBuilderService, authService }
  const createContext = createContextFactory(services, config)

  const app = express()
  app.use(cors({ credentials: true, origin: true }))
  app.use(cookieParser())

  // Proxy MUST be before express.json() to preserve raw request body for piping
  // Also requires auth
  app.use('/proxy', requireAuth(authService), createProxyRouter(sessionService))

  app.use(express.json())

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // File upload API (requires auth)
  app.use('/api/upload', requireAuth(authService), createUploadRouter(config.dataDir, sessionService, containerService))

  app.use('/trpc', trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }))

  // Serve static frontend files
  const webDistPath = path.join(process.cwd(), 'packages/web/dist')
  app.use(express.static(webDistPath))

  // SPA fallback - serve index.html for all non-API routes (but not assets)
  app.get('*', (req, res, next) => {
    // Don't serve index.html for asset requests - let them 404
    if (req.path.startsWith('/assets/')) {
      return next()
    }
    res.sendFile(path.join(webDistPath, 'index.html'))
  })

  const server = createServer(app)

  // Terminal WebSocket server (noServer mode for manual upgrade handling)
  const wss = new WebSocketServer({ noServer: true })
  const terminalHandler = createTerminalHandler(sessionService, containerService)

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const sessionId = url.searchParams.get('session')

    if (sessionId) {
      terminalHandler(ws, sessionId)
    } else {
      logger.info('WebSocket client connected (events)')
      ws.on('close', () => logger.info('WebSocket client disconnected'))
    }
  })

  // Proxy WebSocket handler
  const proxyWsHandler = createProxyWebSocketHandler(sessionService)

  // Handle WebSocket upgrades manually to route to correct handler
  server.on('upgrade', (req, socket, head) => {
    const pathname = req.url?.split('?')[0] || ''

    // Check authentication for WebSocket connections
    const user = checkWebSocketAuth(req, authService)
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    if (pathname === '/ws') {
      // Terminal WebSocket
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    } else if (pathname.startsWith('/proxy/')) {
      // Proxy WebSocket (for Vite HMR, etc.)
      proxyWsHandler(req, socket, head)
    } else {
      socket.destroy()
    }
  })

  server.listen(config.port, config.host, () => {
    logger.info(`Server running on http://${config.host}:${config.port}`)
    logger.info(`Data directory: ${config.dataDir}`)
    logger.info(`Container runtime: ${config.containerRuntime}`)
  })

  const shutdown = () => {
    logger.info('Shutting down...')
    server.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err })
  process.exit(1)
})
