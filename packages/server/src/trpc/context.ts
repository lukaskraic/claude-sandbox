import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import type { ProjectService } from '../services/ProjectService.js'
import type { SessionService } from '../services/SessionService.js'
import type { GitService } from '../services/GitService.js'
import type { ContainerService } from '../services/ContainerService.js'

export interface Services {
  projectService: ProjectService
  sessionService: SessionService
  gitService: GitService
  containerService: ContainerService
}

export interface Context {
  services: Services
}

export function createContextFactory(services: Services) {
  return function createContext({ req, res }: CreateExpressContextOptions): Context {
    return { services }
  }
}
