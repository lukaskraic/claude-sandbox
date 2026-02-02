import type { WebSocket } from 'ws'
import type { SessionService } from '../services/SessionService.js'
import type { ContainerService } from '../services/ContainerService.js'
import { logger } from '../logger.js'

interface TerminalMessage {
  type: 'input' | 'resize' | 'ping'
  data?: string
  cols?: number
  rows?: number
}

export function createTerminalHandler(
  sessionService: SessionService,
  containerService: ContainerService
) {
  return async function handleTerminal(ws: WebSocket, sessionId: string) {
    logger.info('Terminal connection requested', { sessionId })

    const session = await sessionService.get(sessionId)
    if (!session) {
      ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }))
      ws.close()
      return
    }

    if (session.status !== 'running' || !session.container?.id) {
      ws.send(JSON.stringify({ type: 'error', message: 'Session is not running' }))
      ws.close()
      return
    }

    try {
      const { exec, stream } = await containerService.getExecStream(session.container.id)

      stream.on('data', (chunk: Buffer) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data: chunk.toString() }))
        }
      })

      stream.on('end', () => {
        logger.info('Terminal stream ended', { sessionId })
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'exit' }))
          ws.close()
        }
      })

      stream.on('error', (err: Error) => {
        logger.error('Terminal stream error', { sessionId, error: err.message })
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }))
          ws.close()
        }
      })

      ws.on('message', (data: Buffer) => {
        try {
          const message: TerminalMessage = JSON.parse(data.toString())

          if (message.type === 'ping') {
            // Respond to keepalive ping
            ws.send(JSON.stringify({ type: 'pong' }))
          } else if (message.type === 'input' && message.data) {
            stream.write(message.data)
          } else if (message.type === 'resize' && message.cols && message.rows) {
            exec.resize({ h: message.rows, w: message.cols }).catch((err: Error) => {
              logger.warn('Failed to resize terminal', { error: err.message })
            })
          }
        } catch (err) {
          logger.warn('Invalid terminal message', { error: err })
        }
      })

      ws.on('close', () => {
        logger.info('Terminal connection closed', { sessionId })
        stream.end()
      })

      ws.send(JSON.stringify({ type: 'connected' }))
      logger.info('Terminal connected', { sessionId })

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to create terminal', { sessionId, error: message })

      // If container doesn't exist, update session status to stopped
      if (message.includes('no such container') || message.includes('404')) {
        logger.info('Container not found, marking session as stopped', { sessionId })
        await sessionService.markStopped(sessionId)
        ws.send(JSON.stringify({ type: 'error', message: 'Container no longer exists. Please restart the session.' }))
      } else {
        ws.send(JSON.stringify({ type: 'error', message }))
      }
      ws.close()
    }
  }
}
