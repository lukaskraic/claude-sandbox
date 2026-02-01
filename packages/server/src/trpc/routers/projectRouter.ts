import { z } from 'zod'
import { initTRPC } from '@trpc/server'
import type { Context } from '../context.js'

const t = initTRPC.context<Context>().create()

const createProjectSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  git: z.object({
    remote: z.string().url(),
    defaultBranch: z.string().default('main'),
    worktreeBase: z.string().optional(),
  }),
  environment: z.object({
    baseImage: z.string(),
    dockerfile: z.string().optional(),
    services: z.array(z.string()).optional(),
    ports: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
  }),
  mounts: z.array(z.object({
    source: z.string(),
    target: z.string(),
    readonly: z.boolean().optional(),
  })).optional(),
  claude: z.object({
    claudeMd: z.string().optional(),
    permissions: z.array(z.string()).optional(),
  }).optional(),
  setup: z.string().optional(),
})

const updateProjectSchema = createProjectSchema.partial()

export const projectRouter = t.router({
  list: t.procedure.query(({ ctx }) => {
    return ctx.services.projectService.list()
  }),

  get: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.projectService.get(input.id)
    }),

  getByName: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.projectService.getByName(input.name)
    }),

  create: t.procedure
    .input(createProjectSchema)
    .mutation(({ ctx, input }) => {
      return ctx.services.projectService.create(input)
    }),

  update: t.procedure
    .input(z.object({ id: z.string(), data: updateProjectSchema }))
    .mutation(({ ctx, input }) => {
      return ctx.services.projectService.update(input.id, input.data)
    }),

  delete: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.projectService.delete(input.id)
      return { success: true }
    }),

  validate: t.procedure
    .input(createProjectSchema)
    .mutation(({ ctx, input }) => {
      return ctx.services.projectService.validate(input)
    }),
})
