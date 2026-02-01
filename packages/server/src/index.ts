import express from 'express'
import cors from 'cors'
import path from 'path'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import * as trpcExpress from '@trpc/server/adapters/express'
import { loadConfig } from './config.js'
import { logger } from './logger.js'
import { getDatabase } from './db/database.js'
import { ProjectRepository } from './db/repositories/ProjectRepository.js'
import { SessionRepository } from './db/repositories/SessionRepository.js'
import { ProjectService } from './services/ProjectService.js'
import { SessionService } from './services/SessionService.js'
import { GitService } from './services/GitService.js'
import { ContainerService } from './services/ContainerService.js'
import { appRouter } from './trpc/router.js'
import { createContextFactory } from './trpc/context.js'
import { createTerminalHandler } from './ws/terminalHandler.js'
import { promises as fs } from 'fs'

async function main() {
  const config = loadConfig()
  logger.setLevel(config.logLevel)

  await fs.mkdir(config.dataDir, { recursive: true })
  await fs.mkdir(config.worktreeBase, { recursive: true })

  const dbPath = path.join(config.dataDir, 'claude-sandbox.db')
  const db = getDatabase(dbPath)

  const projectRepo = new ProjectRepository(db)
  const sessionRepo = new SessionRepository(db)

  const gitService = new GitService()
  const containerService = new ContainerService(config)
  const projectService = new ProjectService(projectRepo)
  const sessionService = new SessionService(
    sessionRepo,
    projectRepo,
    gitService,
    containerService,
    config
  )

  const services = { projectService, sessionService, gitService, containerService }
  const createContext = createContextFactory(services)

  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use('/trpc', trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }))

  const server = createServer(app)

  const wss = new WebSocketServer({ server, path: '/ws' })
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
