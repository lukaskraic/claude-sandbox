import { Router, Request, Response } from 'express'
import http, { IncomingMessage } from 'http'
import { WebSocket, WebSocketServer } from 'ws'
import { Duplex } from 'stream'
import { SessionService } from '../services/SessionService.js'
import { logger } from '../logger.js'

/**
 * Rewrite absolute URLs in HTML/JS content to use the proxy base path.
 * This allows SPAs to work correctly when served through the proxy.
 */
function rewriteUrls(content: string, basePath: string): string {
  // Rewrite src="/...", href="/...", from="/...", action="/..."
  // But not src="//..." (protocol-relative) or src="http..."
  let result = content

  // HTML attributes with absolute paths
  // Matches: src="/path", href="/path", from="/path", action="/path"
  // Excludes: src="//", src="http", src="data:", src="#", src="."
  result = result.replace(
    /((?:src|href|from|action|poster|data-src)\s*=\s*["'])\/(?!\/|#)([^"']*["'])/gi,
    `$1${basePath}/$2`
  )

  // CSS url(/path) - but not url(//) or url(data:) or url(#)
  result = result.replace(
    /(url\s*\(\s*["']?)\/(?!\/|#|data:)([^)"']*["']?\s*\))/gi,
    `$1${basePath}/$2`
  )

  // ES module static imports: import "/path" or import '/path'
  // Matches: import "/node_modules/...", import '/src/...'
  result = result.replace(
    /(import\s+["'])\/(?!\/)/gi,
    `$1${basePath}/`
  )

  // ES module named imports: import { x } from "/path" or export { x } from "/path"
  // Matches: import { foo } from "/themeConfig.ts", export * from "/utils"
  result = result.replace(
    /(from\s+["'])\/(?!\/)/gi,
    `$1${basePath}/`
  )

  // ES module dynamic imports: import("/path") or import('/path')
  result = result.replace(
    /(import\s*\(\s*["'])\/(?!\/)/gi,
    `$1${basePath}/`
  )

  // NOTE: Removed fetch/axios URL rewrite - it was causing double-prefixing
  // API paths like .get("/v1/...") should stay relative since baseURL is rewritten

  // Axios baseURL configuration: baseURL: "/api" or baseURL: '/api'
  result = result.replace(
    /(baseURL\s*:\s*["'])\/(?!\/)/gi,
    `$1${basePath}/`
  )

  // Fallback patterns like || "/api" or || '/api'
  result = result.replace(
    /(\|\|\s*["'])\/api(["'])/gi,
    `$1${basePath}/api$2`
  )

  // new URL("/path", import.meta.url)
  result = result.replace(
    /(new\s+URL\s*\(\s*["'])\/(?!\/)/gi,
    `$1${basePath}/`
  )

  // Vite specific: /@vite/, /@id/, /@fs/, /@react-refresh, /node_modules/
  // These need special handling
  result = result.replace(
    /(["'])\/@(vite|id|fs|react-refresh)/gi,
    `$1${basePath}/@$2`
  )

  // /node_modules/ paths (common in Vite dev)
  result = result.replace(
    /(["'])\/node_modules\//gi,
    `$1${basePath}/node_modules/`
  )

  // /src/ paths (Vite dev serves source directly)
  result = result.replace(
    /(["'])\/src\//gi,
    `$1${basePath}/src/`
  )

  // Vite HMR base path: const base$1 = "/" || "/" and const base = "/" || "/"
  // This is crucial for HMR WebSocket to connect to the right path
  result = result.replace(
    /const base\$1 = "\/"/gi,
    `const base$1 = "${basePath}/"`
  )
  result = result.replace(
    /const base = "\/"/gi,
    `const base = "${basePath}/"`
  )

  // Vite import.meta.env.BASE_URL: "BASE_URL": "/" → "BASE_URL": "/proxy/.../"
  // This fixes Vue Router base path
  result = result.replace(
    /"BASE_URL":\s*"\/"/gi,
    `"BASE_URL": "${basePath}/"`
  )

  // Vite HMR socketHost trailing path: ${"/"} or ${'/'} at end of socketHost
  // Pattern: `${null || hostname}:${port}${"/"}` → `${null || hostname}:${port}${"basePath/"}`
  result = result.replace(
    /\$\{"\/"\}/g,
    `\${"${basePath}/"}`
  )
  result = result.replace(
    /\$\{'\/'\}/g,
    `\${'${basePath}/'}`
  )

  return result
}

/**
 * Check if content type is HTML or JavaScript (needs URL rewriting)
 */
function shouldRewriteContent(contentType: string | undefined): boolean {
  if (!contentType) return false
  return contentType.includes('text/html') ||
         contentType.includes('application/javascript') ||
         contentType.includes('text/javascript') ||
         contentType.includes('application/json')
}

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

      // Calculate base path for URL rewriting
      const basePath = `/proxy/${sessionId}/${containerPort}`

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

      // Proxy the request with extended timeout for long-running operations
      const proxyReq = http.request(
        {
          hostname: 'localhost',
          port: hostPort,
          path: targetPath,
          method: req.method,
          timeout: 600000, // 10 minutes timeout
          headers: {
            ...req.headers,
            host: `localhost:${hostPort}`,
            // Remove accept-encoding to get uncompressed response for rewriting
            'accept-encoding': 'identity',
          },
        },
        (proxyRes) => {
          const contentType = proxyRes.headers['content-type']
          const needsRewrite = shouldRewriteContent(contentType)

          if (needsRewrite) {
            // Buffer the response for URL rewriting
            const chunks: Buffer[] = []

            proxyRes.on('data', (chunk: Buffer) => {
              chunks.push(chunk)
            })

            proxyRes.on('end', () => {
              let content = Buffer.concat(chunks).toString('utf-8')
              content = rewriteUrls(content, basePath)

              // Update content-length header
              const headers = { ...proxyRes.headers }
              headers['content-length'] = Buffer.byteLength(content).toString()
              delete headers['content-encoding'] // Remove any encoding header

              res.writeHead(proxyRes.statusCode || 500, headers)
              res.end(content)
            })
          } else {
            // Pass through non-HTML/JS content unchanged
            res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
            proxyRes.pipe(res)
          }
        }
      )

      proxyReq.on('error', (err) => {
        logger.error('Proxy request failed', { sessionId, containerPort: targetPort, error: err.message })
        if (!res.headersSent) {
          res.status(502).json({ error: 'Failed to connect to container', details: err.message })
        }
      })

      proxyReq.on('timeout', () => {
        logger.error('Proxy request timeout', { sessionId, containerPort: targetPort })
        proxyReq.destroy()
        if (!res.headersSent) {
          res.status(504).json({ error: 'Request timeout' })
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

/**
 * Create WebSocket upgrade handler for proxy routes.
 * This handles WebSocket connections for things like Vite HMR.
 */
export function createProxyWebSocketHandler(sessionService: SessionService) {
  return async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = req.url || ''

    // Parse /proxy/:sessionId/:containerPort/... pattern
    const match = url.match(/^\/proxy\/([^/]+)\/(\d+)(.*)$/)
    if (!match) {
      socket.destroy()
      return
    }

    const [, sessionId, containerPort, wsPath] = match
    const targetPort = parseInt(containerPort, 10)

    try {
      const session = await sessionService.get(sessionId)

      if (!session || session.status !== 'running') {
        logger.warn('WebSocket proxy: session not found or not running', { sessionId })
        socket.destroy()
        return
      }

      const hostPort = session.container?.ports?.[targetPort]
      if (!hostPort) {
        logger.warn('WebSocket proxy: port not exposed', { sessionId, targetPort })
        socket.destroy()
        return
      }

      logger.debug('Proxying WebSocket', {
        sessionId,
        containerPort: targetPort,
        hostPort,
        path: wsPath || '/',
      })

      // Connect to the container's WebSocket
      const targetWs = new WebSocket(`ws://localhost:${hostPort}${wsPath || '/'}`, {
        headers: {
          ...req.headers,
          host: `localhost:${hostPort}`,
        },
      })

      targetWs.on('open', () => {
        // Create a WebSocket server instance to handle the upgrade
        const wss = new WebSocketServer({ noServer: true })

        wss.handleUpgrade(req, socket, head, (clientWs) => {
          // Pipe messages between client and target
          clientWs.on('message', (data) => {
            if (targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(data)
            }
          })

          targetWs.on('message', (data) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(data)
            }
          })

          clientWs.on('close', () => {
            targetWs.close()
          })

          targetWs.on('close', () => {
            clientWs.close()
          })

          clientWs.on('error', (err) => {
            logger.error('Proxy WebSocket client error', { error: err.message })
            targetWs.close()
          })

          targetWs.on('error', (err) => {
            logger.error('Proxy WebSocket target error', { error: err.message })
            clientWs.close()
          })
        })
      })

      targetWs.on('error', (err) => {
        logger.error('Failed to connect to container WebSocket', {
          sessionId,
          targetPort,
          error: err.message
        })
        socket.destroy()
      })

    } catch (err) {
      logger.error('WebSocket proxy error', { sessionId, error: err })
      socket.destroy()
    }
  }
}
