import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { loadConfig } from './config.js'
import { logger } from './logger.js'

const config = loadConfig()
logger.setLevel(config.logLevel)

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected')
  ws.on('close', () => logger.info('WebSocket client disconnected'))
})

server.listen(config.port, config.host, () => {
  logger.info(`Server running on http://${config.host}:${config.port}`)
})
