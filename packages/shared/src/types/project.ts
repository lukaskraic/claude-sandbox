export interface ProjectGitConfig {
  remote: string
  defaultBranch: string
  worktreeBase?: string
}

export interface ProjectMount {
  source: string
  target: string
  readonly?: boolean
}

// MCP Server configuration
export interface MCPServerConfig {
  id: string                      // unique identifier
  name: string                    // display name (e.g., "playwright")
  command: string                 // command (e.g., "npx")
  args: string[]                  // arguments (e.g., ["-y", "@playwright/mcp@latest"])
  env?: Record<string, string>    // environment variables
  enabled: boolean                // on/off toggle
}

export type MCPPreset = 'playwright'

export interface ProjectClaudeConfig {
  claudeMd?: string
  permissions?: string[]
  mcpServers?: MCPServerConfig[]
}

// Runtime versions
export interface ProjectRuntimes {
  java?: string      // "21", "17", "11"
  node?: string      // "20", "18", "16"
  python?: string    // "3.12", "3.11"
  go?: string        // "1.22", "1.21"
}

// Tools to install
export interface ProjectTools {
  npm?: string[]     // ["typescript", "@vue/cli"]
  pip?: string[]     // ["requests", "flask"]
  custom?: string[]  // ["claude-code"]
}

// Proxy configuration
export interface ProxyConfig {
  http?: string       // http://proxy.example.com:8080
  https?: string      // http://proxy.example.com:8080
  noProxy?: string    // localhost,127.0.0.1,.local
}

// Service definitions
export type ServiceType = 'postgres' | 'mysql' | 'redis' | 'mongodb' | 'elasticsearch'

export interface ProjectService {
  type: ServiceType
  version: string
  database?: string  // for postgres/mysql
  user?: string
  password?: string
  initSqlFile?: string  // Path to SQL file relative to worktree (e.g., "sql/init.sql")
}

export interface ProjectEnvironment {
  baseImage: string
  runtimes?: ProjectRuntimes
  packages?: string[]           // apt packages
  tools?: ProjectTools
  services?: ProjectService[]
  setup?: string                // custom bash script
  ports?: string[]
  env?: Record<string, string>
  proxy?: ProxyConfig           // Proxy settings for build and runtime
}

// Cached image info
export interface ProjectImage {
  id: string
  projectId: string
  imageTag: string
  configHash: string
  status: 'building' | 'ready' | 'failed'
  error?: string
  builtAt?: Date
}

export interface Project {
  id: string
  name: string
  description?: string
  git: ProjectGitConfig
  environment: ProjectEnvironment
  mounts?: ProjectMount[]
  claude?: ProjectClaudeConfig
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
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  git?: Partial<ProjectGitConfig>
  environment?: Partial<ProjectEnvironment>
  mounts?: ProjectMount[]
  claude?: ProjectClaudeConfig
}
