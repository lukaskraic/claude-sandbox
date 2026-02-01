export interface ProjectGitConfig {
  remote: string
  defaultBranch: string
  worktreeBase: string
}

export interface ProjectMount {
  source: string
  target: string
  readonly?: boolean
}

export interface ProjectClaudeConfig {
  claudeMd?: string
  permissions?: string[]
}

export interface ProjectEnvironment {
  baseImage: string
  dockerfile?: string
  services?: string[]
  ports?: string[]
  env?: Record<string, string>
}

export interface Project {
  id: string
  name: string
  description?: string
  git: ProjectGitConfig
  environment: ProjectEnvironment
  mounts?: ProjectMount[]
  claude?: ProjectClaudeConfig
  setup?: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateProjectInput {
  name: string
  description?: string
  git: ProjectGitConfig
  environment: ProjectEnvironment
  mounts?: ProjectMount[]
  claude?: ProjectClaudeConfig
  setup?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  git?: Partial<ProjectGitConfig>
  environment?: Partial<ProjectEnvironment>
  mounts?: ProjectMount[]
  claude?: ProjectClaudeConfig
  setup?: string
}
