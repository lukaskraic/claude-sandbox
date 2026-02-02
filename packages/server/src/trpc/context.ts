import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import type { ProjectService } from '../services/ProjectService.js'
import type { SessionService } from '../services/SessionService.js'
import type { GitService } from '../services/GitService.js'
import type { ContainerService } from '../services/ContainerService.js'
import type { ImageBuilderService } from '../services/ImageBuilderService.js'
import type { Config } from '../config.js'

export interface Services {
  projectService: ProjectService
  sessionService: SessionService
  gitService: GitService
  containerService: ContainerService
  imageBuilderService: ImageBuilderService
}

export interface Context {
  services: Services
  config: Config
}

export function createContextFactory(services: Services, config: Config) {
  return function createContext({ req, res }: CreateExpressContextOptions): Context {
    return { services, config }
  }
}
