import type { Project, CreateProjectInput, UpdateProjectInput } from '@claude-sandbox/shared'
import { ProjectRepository } from '../db/repositories/ProjectRepository.js'
import { logger } from '../logger.js'

export class ProjectService {
  constructor(private projectRepo: ProjectRepository) {}

  async list(): Promise<Project[]> {
    return this.projectRepo.findAll()
  }

  async get(id: string): Promise<Project | null> {
    return this.projectRepo.findById(id)
  }

  async getByName(name: string): Promise<Project | null> {
    return this.projectRepo.findByName(name)
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const existing = this.projectRepo.findByName(input.name)
    if (existing) {
      throw new Error(`Project with name "${input.name}" already exists`)
    }

    this.validateProjectInput(input)

    const project = this.projectRepo.create(input)
    logger.info('Project created', { id: project.id, name: project.name })
    return project
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const existing = this.projectRepo.findById(id)
    if (!existing) {
      throw new Error(`Project not found: ${id}`)
    }

    if (input.name && input.name !== existing.name) {
      const nameConflict = this.projectRepo.findByName(input.name)
      if (nameConflict) {
        throw new Error(`Project with name "${input.name}" already exists`)
      }
    }

    const updated = this.projectRepo.update(id, input)
    logger.info('Project updated', { id, name: updated?.name })
    return updated!
  }

  async delete(id: string): Promise<void> {
    const existing = this.projectRepo.findById(id)
    if (!existing) {
      throw new Error(`Project not found: ${id}`)
    }

    const deleted = this.projectRepo.delete(id)
    if (deleted) {
      logger.info('Project deleted', { id, name: existing.name })
    }
  }

  async validate(input: CreateProjectInput): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (!input.name || input.name.trim().length === 0) {
      errors.push('Project name is required')
    } else if (!/^[a-z0-9-]+$/.test(input.name)) {
      errors.push('Project name must contain only lowercase letters, numbers, and hyphens')
    }

    if (!input.git?.remote) {
      errors.push('Git remote URL is required')
    }

    if (!input.git?.defaultBranch) {
      errors.push('Git default branch is required')
    }

    if (!input.environment?.baseImage) {
      errors.push('Base image is required')
    }

    return { valid: errors.length === 0, errors }
  }

  private validateProjectInput(input: CreateProjectInput): void {
    if (!input.name || !/^[a-z0-9-]+$/.test(input.name)) {
      throw new Error('Invalid project name. Use lowercase letters, numbers, and hyphens only.')
    }

    if (!input.git?.remote) {
      throw new Error('Git remote URL is required')
    }

    if (!input.environment?.baseImage) {
      throw new Error('Base image is required')
    }
  }
}
