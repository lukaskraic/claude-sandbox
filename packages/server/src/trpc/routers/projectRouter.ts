import { z } from 'zod'
import type { CreateProjectInput, UpdateProjectInput } from '@claude-sandbox/shared'
import { t, protectedProcedure } from '../trpc.js'

// Helper to convert null to undefined recursively
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nullToUndefined(obj: any): any {
  if (obj === null) return undefined
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(nullToUndefined)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = nullToUndefined(value)
  }
  return result
}

const serviceSchema = z.object({
  type: z.enum(['postgres', 'mysql', 'redis', 'mongodb', 'elasticsearch']),
  version: z.string(),
  database: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
  initSqlFile: z.string().optional(),
})

const proxySchema = z.object({
  http: z.string().optional(),
  https: z.string().optional(),
  noProxy: z.string().optional(),
})

const mcpServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string()).optional(),
  enabled: z.boolean(),
})

const createProjectSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  git: z.object({
    remote: z.string().min(1),  // Accepts HTTPS URLs and SSH git@... format
    defaultBranch: z.string().default('main'),
    worktreeBase: z.string().optional(),
  }),
  environment: z.object({
    baseImage: z.string(),
    runtimes: z.object({
      java: z.string().optional(),
      node: z.string().optional(),
      python: z.string().optional(),
      go: z.string().optional(),
    }).nullish(),
    packages: z.array(z.string()).optional(),
    tools: z.object({
      npm: z.array(z.string()).optional(),
      pip: z.array(z.string()).optional(),
      custom: z.array(z.string()).optional(),
    }).nullish(),
    services: z.array(serviceSchema).optional(),
    setup: z.string().optional(),
    ports: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
    proxy: proxySchema.optional(),
  }),
  mounts: z.array(z.object({
    source: z.string(),
    target: z.string(),
    readonly: z.boolean().optional(),
  })).optional(),
  claude: z.object({
    claudeMd: z.string().optional(),
    permissions: z.array(z.string()).optional(),
    mcpServers: z.array(mcpServerSchema).optional(),
  }).optional(),
})

const updateProjectSchema = createProjectSchema.partial()

export const projectRouter = t.router({
  list: protectedProcedure.query(({ ctx }) => {
    return ctx.services.projectService.list()
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.projectService.get(input.id)
    }),

  getByName: protectedProcedure
    .input(z.object({ name: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.projectService.getByName(input.name)
    }),

  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(({ ctx, input }) => {
      return ctx.services.projectService.create(nullToUndefined(input) as CreateProjectInput)
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: updateProjectSchema }))
    .mutation(({ ctx, input }) => {
      return ctx.services.projectService.update(input.id, nullToUndefined(input.data) as UpdateProjectInput)
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.projectService.delete(input.id)
      return { success: true }
    }),

  validate: protectedProcedure
    .input(createProjectSchema)
    .mutation(({ ctx, input }) => {
      return ctx.services.projectService.validate(nullToUndefined(input) as CreateProjectInput)
    }),

  rebuildImage: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.services.projectService.get(input.id)
      if (!project) {
        throw new Error('Project not found')
      }
      const imageTag = await ctx.services.imageBuilderService.rebuildImage(project)
      return { imageTag }
    }),

  getImageStatus: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.imageBuilderService.getImageStatus(input.id)
    }),
})
