import type { Request, Response, NextFunction } from 'express'
import type { IncomingMessage } from 'http'
import type { AuthService } from '../services/AuthService.js'

/**
 * Parse cookies from a cookie header string
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=')
    if (name) {
      cookies[name.trim()] = rest.join('=').trim()
    }
  })

  return cookies
}

/**
 * Express middleware to require authentication
 */
export function requireAuth(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if no users configured
    if (!authService.hasUsers()) {
      return next()
    }

    const sessionId = req.cookies?.session_id
    if (!sessionId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const session = authService.getSession(sessionId)
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    // Touch session to keep it alive
    authService.touchSession(sessionId)

    // Add user to request
    ;(req as any).user = session.username

    next()
  }
}

/**
 * Check if a WebSocket upgrade request is authenticated
 * Returns the username if authenticated, null otherwise
 */
export function checkWebSocketAuth(
  req: IncomingMessage,
  authService: AuthService
): string | null {
  // Skip if no users configured
  if (!authService.hasUsers()) {
    return 'anonymous'
  }

  const cookies = parseCookies(req.headers.cookie)
  const sessionId = cookies.session_id

  if (!sessionId) {
    return null
  }

  const session = authService.getSession(sessionId)
  if (!session) {
    return null
  }

  // Touch session to keep it alive
  authService.touchSession(sessionId)

  return session.username
}
