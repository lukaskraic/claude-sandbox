import { randomUUID } from 'crypto'
import { timingSafeEqual } from 'crypto'
import type Database from 'better-sqlite3'
import type { Config } from '../config.js'
import { logger } from '../logger.js'

export interface AuthSession {
  id: string
  username: string
  createdAt: number
  lastAccessed: number
}

export class AuthService {
  private users: Map<string, string>
  private db: Database.Database

  constructor(db: Database.Database, config: Config) {
    this.db = db
    this.users = new Map()

    for (const { username, password } of config.authUsers) {
      this.users.set(username, password)
    }

    if (this.users.size === 0) {
      logger.warn('No auth users configured - authentication will fail for all requests')
    } else {
      logger.info(`Auth configured with ${this.users.size} user(s)`)
    }

    // Cleanup old sessions on startup
    this.cleanupOldSessions()
  }

  validateCredentials(username: string, password: string): boolean {
    const storedPassword = this.users.get(username)
    if (!storedPassword) {
      return false
    }

    // Timing-safe comparison to prevent timing attacks
    const a = Buffer.from(password)
    const b = Buffer.from(storedPassword)

    if (a.length !== b.length) {
      return false
    }

    return timingSafeEqual(a, b)
  }

  createSession(username: string): string {
    const id = randomUUID()
    const now = Date.now()

    this.db.prepare(`
      INSERT INTO auth_sessions (id, username, created_at, last_accessed)
      VALUES (?, ?, ?, ?)
    `).run(id, username, now, now)

    logger.info('Created auth session', { username, sessionId: id })
    return id
  }

  getSession(sessionId: string): AuthSession | null {
    if (!sessionId) {
      return null
    }

    const row = this.db.prepare(`
      SELECT id, username, created_at as createdAt, last_accessed as lastAccessed
      FROM auth_sessions
      WHERE id = ?
    `).get(sessionId) as AuthSession | undefined

    return row || null
  }

  touchSession(sessionId: string): void {
    this.db.prepare(`
      UPDATE auth_sessions SET last_accessed = ? WHERE id = ?
    `).run(Date.now(), sessionId)
  }

  deleteSession(sessionId: string): void {
    this.db.prepare(`
      DELETE FROM auth_sessions WHERE id = ?
    `).run(sessionId)

    logger.info('Deleted auth session', { sessionId })
  }

  deleteUserSessions(username: string): void {
    const result = this.db.prepare(`
      DELETE FROM auth_sessions WHERE username = ?
    `).run(username)

    logger.info('Deleted all sessions for user', { username, count: result.changes })
  }

  cleanupOldSessions(): void {
    // Remove sessions older than 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const result = this.db.prepare(`
      DELETE FROM auth_sessions WHERE last_accessed < ?
    `).run(sevenDaysAgo)

    if (result.changes > 0) {
      logger.info('Cleaned up old auth sessions', { count: result.changes })
    }
  }

  hasUsers(): boolean {
    return this.users.size > 0
  }
}
