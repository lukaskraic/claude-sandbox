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
  authUsers: z.array(z.object({
    username: z.string(),
    password: z.string(),
  })).default([]),
})

export type Config = z.infer<typeof configSchema>

export function loadConfig(): Config {
  const claudeUsers = process.env.CLAUDE_SOURCE_USERS?.split(',').filter(Boolean) || [
    'licencieclaude13',
    'licencieclaude21',
    'kula',
  ]

  // Parse AUTH_USERS=user1:pass1,user2:pass2
  const authUsers = (process.env.AUTH_USERS || '')
    .split(',')
    .filter(Boolean)
    .map(entry => {
      const [username, password] = entry.split(':')
      return { username: username?.trim(), password: password?.trim() }
    })
    .filter(u => u.username && u.password) as { username: string; password: string }[]

  return configSchema.parse({
    port: parseInt(process.env.PORT || '3020'),
    host: process.env.HOST || '127.0.0.1',
    dataDir: process.env.DATA_DIR || '/srv/claude-sandbox/data',
    worktreeBase: process.env.WORKTREE_BASE || '/srv/claude-sandbox/worktrees',
    containerRuntime: process.env.CONTAINER_RUNTIME || 'podman',
    containerSocket: process.env.CONTAINER_SOCKET || '/run/podman/podman.sock',
    logLevel: process.env.LOG_LEVEL || 'info',
    claudeSourceUsers: claudeUsers,
    authUsers,
  })
}
