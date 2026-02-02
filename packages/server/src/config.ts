import { z } from 'zod'

const configSchema = z.object({
  port: z.number().default(3020),
  host: z.string().default('127.0.0.1'),
  dataDir: z.string().default('/srv/claude-sandbox/data'),
  worktreeBase: z.string().default('/srv/claude-sandbox/worktrees'),
  containerRuntime: z.enum(['podman', 'docker']).default('podman'),
  containerSocket: z.string().default('/run/podman/podman.sock'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  claudeSourceUsers: z.array(z.string()).default([]),
})

export type Config = z.infer<typeof configSchema>

export function loadConfig(): Config {
  const claudeUsers = process.env.CLAUDE_SOURCE_USERS?.split(',').filter(Boolean) || [
    'licencieclaude13',
    'kula',
  ]

  return configSchema.parse({
    port: parseInt(process.env.PORT || '3020'),
    host: process.env.HOST || '127.0.0.1',
    dataDir: process.env.DATA_DIR || '/srv/claude-sandbox/data',
    worktreeBase: process.env.WORKTREE_BASE || '/srv/claude-sandbox/worktrees',
    containerRuntime: process.env.CONTAINER_RUNTIME || 'podman',
    containerSocket: process.env.CONTAINER_SOCKET || '/run/podman/podman.sock',
    logLevel: process.env.LOG_LEVEL || 'info',
    claudeSourceUsers: claudeUsers,
  })
}
