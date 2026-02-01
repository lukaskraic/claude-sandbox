import type { Database } from 'better-sqlite3'
import { v4 as uuid } from 'uuid'
import type { Session, CreateSessionInput, SessionStatus } from '@claude-sandbox/shared'

interface SessionRow {
  id: string
  project_id: string
  name: string
  status: string
  worktree_path: string | null
  worktree_branch: string | null
  worktree_commit: string | null
  container_id: string | null
  container_ports: string | null
  error: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export class SessionRepository {
  constructor(private db: Database) {}

  findAll(): Session[] {
    const rows = this.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all() as SessionRow[]
    return rows.map(this.rowToSession)
  }

  findByProjectId(projectId: string): Session[] {
    const rows = this.db.prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as SessionRow[]
    return rows.map(this.rowToSession)
  }

  findById(id: string): Session | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined
    return row ? this.rowToSession(row) : null
  }

  findByStatus(status: SessionStatus): Session[] {
    const rows = this.db.prepare('SELECT * FROM sessions WHERE status = ?').all(status) as SessionRow[]
    return rows.map(this.rowToSession)
  }

  create(projectId: string, input: CreateSessionInput, createdBy?: string): Session {
    const id = uuid()
    const now = new Date().toISOString()

    this.db.prepare(`
      INSERT INTO sessions (id, project_id, name, status, worktree_branch, created_at, updated_at, created_by)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
    `).run(id, projectId, input.name, input.branch || null, now, now, createdBy || null)

    return this.findById(id)!
  }

  updateStatus(id: string, status: SessionStatus, error?: string): Session | null {
    const now = new Date().toISOString()
    this.db.prepare(`
      UPDATE sessions SET status = ?, error = ?, updated_at = ? WHERE id = ?
    `).run(status, error || null, now, id)
    return this.findById(id)
  }

  updateWorktree(id: string, path: string, branch: string, commit?: string): Session | null {
    const now = new Date().toISOString()
    this.db.prepare(`
      UPDATE sessions SET worktree_path = ?, worktree_branch = ?, worktree_commit = ?, updated_at = ? WHERE id = ?
    `).run(path, branch, commit || null, now, id)
    return this.findById(id)
  }

  updateContainer(id: string, containerId: string, ports: Record<number, number>): Session | null {
    const now = new Date().toISOString()
    this.db.prepare(`
      UPDATE sessions SET container_id = ?, container_ports = ?, updated_at = ? WHERE id = ?
    `).run(containerId, JSON.stringify(ports), now, id)
    return this.findById(id)
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
    return result.changes > 0
  }

  private rowToSession(row: SessionRow): Session {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      status: row.status as SessionStatus,
      worktree: row.worktree_path ? {
        path: row.worktree_path,
        branch: row.worktree_branch!,
        commit: row.worktree_commit || undefined,
      } : undefined,
      container: row.container_id ? {
        id: row.container_id,
        ports: row.container_ports ? JSON.parse(row.container_ports) : {},
      } : undefined,
      error: row.error || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by || undefined,
    }
  }
}
