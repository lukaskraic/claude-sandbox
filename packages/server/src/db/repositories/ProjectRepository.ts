import type { Database } from 'better-sqlite3'
import { v4 as uuid } from 'uuid'
import type { Project, CreateProjectInput, UpdateProjectInput } from '@claude-sandbox/shared'

interface ProjectRow {
  id: string
  name: string
  description: string | null
  config: string
  created_at: string
  updated_at: string
}

export class ProjectRepository {
  constructor(private db: Database) {}

  findAll(): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY name').all() as ProjectRow[]
    return rows.map(this.rowToProject)
  }

  findById(id: string): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
    return row ? this.rowToProject(row) : null
  }

  findByName(name: string): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE name = ?').get(name) as ProjectRow | undefined
    return row ? this.rowToProject(row) : null
  }

  create(input: CreateProjectInput): Project {
    const id = uuid()
    const now = new Date().toISOString()
    const config = JSON.stringify({
      git: input.git,
      environment: input.environment,
      mounts: input.mounts,
      claude: input.claude,
    })

    this.db.prepare(`
      INSERT INTO projects (id, name, description, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, input.name, input.description || null, config, now, now)

    return this.findById(id)!
  }

  update(id: string, input: UpdateProjectInput): Project | null {
    const existing = this.findById(id)
    if (!existing) return null

    const now = new Date().toISOString()
    // Use explicit replacement - frontend sends complete objects
    // null values explicitly clear fields, undefined keeps existing
    const newConfig = {
      git: input.git ?? existing.git,
      environment: input.environment ?? existing.environment,
      mounts: 'mounts' in input ? input.mounts : existing.mounts,
      claude: 'claude' in input ? input.claude : existing.claude,
    }
    const config = JSON.stringify(newConfig)

    this.db.prepare(`
      UPDATE projects SET name = ?, description = ?, config = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.name ?? existing.name,
      input.description ?? existing.description ?? null,
      config,
      now,
      id
    )

    return this.findById(id)
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    return result.changes > 0
  }

  private rowToProject(row: ProjectRow): Project {
    const config = JSON.parse(row.config)
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      git: config.git,
      environment: config.environment,
      mounts: config.mounts,
      claude: config.claude,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }
}
