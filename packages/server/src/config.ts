import { z } from 'zod'

const configSchema = z.object({
  port: z.number().default(3001),
  host: z.string().default('0.0.0.0'),
  dataDir: z.string().default('/data/claude-sandbox'),
  worktreeBase: z.string().default('/data/worktrees'),
  containerRuntime: z.enum(['podman', 'docker']).default('podman'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type Config = z.infer<typeof configSchema>

export function loadConfig(): Config {
  return configSchema.parse({
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || '0.0.0.0',
    dataDir: process.env.DATA_DIR || '/data/claude-sandbox',
    worktreeBase: process.env.WORKTREE_BASE || '/data/worktrees',
    containerRuntime: process.env.CONTAINER_RUNTIME || 'podman',
    logLevel: process.env.LOG_LEVEL || 'info',
  })
}
