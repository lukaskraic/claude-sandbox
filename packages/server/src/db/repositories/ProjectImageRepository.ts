import type { Database } from 'better-sqlite3'
import { v4 as uuid } from 'uuid'
import type { ProjectImage } from '@claude-sandbox/shared'

interface ProjectImageRow {
  id: string
  project_id: string
  image_tag: string
  config_hash: string
  status: string
  error: string | null
  built_at: string | null
}

export class ProjectImageRepository {
  constructor(private db: Database) {}

  findByProjectId(projectId: string): ProjectImage | null {
    const row = this.db.prepare(
      'SELECT * FROM project_images WHERE project_id = ? ORDER BY built_at DESC LIMIT 1'
    ).get(projectId) as ProjectImageRow | undefined
    return row ? this.rowToProjectImage(row) : null
  }

  findByConfigHash(projectId: string, configHash: string): ProjectImage | null {
    const row = this.db.prepare(
      'SELECT * FROM project_images WHERE project_id = ? AND config_hash = ? AND status = ?'
    ).get(projectId, configHash, 'ready') as ProjectImageRow | undefined
    return row ? this.rowToProjectImage(row) : null
  }

  create(projectId: string, imageTag: string, configHash: string): ProjectImage {
    const id = uuid()
    this.db.prepare(`
      INSERT INTO project_images (id, project_id, image_tag, config_hash, status)
      VALUES (?, ?, ?, ?, 'building')
    `).run(id, projectId, imageTag, configHash)
    return this.findById(id)!
  }

  findById(id: string): ProjectImage | null {
    const row = this.db.prepare('SELECT * FROM project_images WHERE id = ?').get(id) as ProjectImageRow | undefined
    return row ? this.rowToProjectImage(row) : null
  }

  updateStatus(id: string, status: 'building' | 'ready' | 'failed', error?: string): ProjectImage | null {
    const builtAt = status === 'ready' ? new Date().toISOString() : null
    this.db.prepare(`
      UPDATE project_images SET status = ?, error = ?, built_at = ? WHERE id = ?
    `).run(status, error || null, builtAt, id)
    return this.findById(id)
  }

  deleteByProjectId(projectId: string): void {
    this.db.prepare('DELETE FROM project_images WHERE project_id = ?').run(projectId)
  }

  private rowToProjectImage(row: ProjectImageRow): ProjectImage {
    return {
      id: row.id,
      projectId: row.project_id,
      imageTag: row.image_tag,
      configHash: row.config_hash,
      status: row.status as 'building' | 'ready' | 'failed',
      error: row.error || undefined,
      builtAt: row.built_at ? new Date(row.built_at) : undefined,
    }
  }
}
