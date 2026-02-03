import { Router, Request, Response } from 'express'
import http from 'http'
import { SessionService } from '../services/SessionService.js'
import { logger } from '../logger.js'

export function createProxyRouter(sessionService: SessionService): Router {
  const router = Router()

  // Proxy requests to session container ports
  // URL format: /proxy/:sessionId/:containerPort/*
  router.all('/:sessionId/:containerPort/*', async (req: Request, res: Response) => {
    const { sessionId, containerPort } = req.params
    const targetPort = parseInt(containerPort, 10)

    if (isNaN(targetPort)) {
      res.status(400).json({ error: 'Invalid port' })
      return
    }

    try {
      const session = await sessionService.get(sessionId)

      if (!session) {
        res.status(404).json({ error: 'Session not found' })
        return
      }

      if (session.status !== 'running') {
        res.status(400).json({ error: 'Session is not running' })
        return
      }

      const hostPort = session.container?.ports?.[targetPort]

      if (!hostPort) {
        res.status(404).json({ error: `Port ${targetPort} is not exposed in this session` })
        return
      }

      // Get the path after the port number
      const pathIndex = req.originalUrl.indexOf(`/${containerPort}/`)
      const targetPath = pathIndex !== -1
        ? req.originalUrl.slice(pathIndex + `/${containerPort}`.length)
        : '/'

      logger.debug('Proxying request', {
        sessionId,
        containerPort: targetPort,
        hostPort,
        path: targetPath,
        method: req.method,
      })

      // Proxy the request
      const proxyReq = http.request(
        {
          hostname: 'localhost',
          port: hostPort,
          path: targetPath,
          method: req.method,
          headers: {
            ...req.headers,
            host: `localhost:${hostPort}`,
          },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
          proxyRes.pipe(res)
        }
      )

      proxyReq.on('error', (err) => {
        logger.error('Proxy request failed', { sessionId, containerPort: targetPort, error: err.message })
        if (!res.headersSent) {
          res.status(502).json({ error: 'Failed to connect to container', details: err.message })
        }
      })

      // Pipe request body for POST/PUT
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        req.pipe(proxyReq)
      } else {
        proxyReq.end()
      }

    } catch (err) {
      logger.error('Proxy error', { sessionId, error: err })
      res.status(500).json({ error: 'Internal proxy error' })
    }
  })

  // Also handle root path for the port
  router.all('/:sessionId/:containerPort', async (req: Request, res: Response) => {
    // Redirect to path with trailing slash
    res.redirect(`${req.originalUrl}/`)
  })

  return router
}
