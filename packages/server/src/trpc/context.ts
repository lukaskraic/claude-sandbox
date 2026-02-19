import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import type { Response } from 'express'
import type { ProjectService } from '../services/ProjectService.js'
import type { SessionService } from '../services/SessionService.js'
import type { GitService } from '../services/GitService.js'
import type { ContainerService } from '../services/ContainerService.js'
import type { ImageBuilderService } from '../services/ImageBuilderService.js'
import type { AuthService } from '../services/AuthService.js'
import type { WorktreeService } from '../services/WorktreeService.js'
import type { Config } from '../config.js'

export interface Services {
  projectService: ProjectService
  sessionService: SessionService
  gitService: GitService
  containerService: ContainerService
  imageBuilderService: ImageBuilderService
  authService: AuthService
  worktreeService: WorktreeService
}

export interface Context {
  services: Services
  config: Config
  user: string | null
  res: Response
}

export function createContextFactory(services: Services, config: Config) {
  return function createContext({ req, res }: CreateExpressContextOptions): Context {
    // Get session from cookie
    const sessionId = req.cookies?.session_id
    let user: string | null = null

    if (sessionId) {
      const session = services.authService.getSession(sessionId)
      if (session) {
        user = session.username
        // Touch session to keep it alive
        services.authService.touchSession(sessionId)
      }
    }

    return { services, config, user, res }
  }
}
