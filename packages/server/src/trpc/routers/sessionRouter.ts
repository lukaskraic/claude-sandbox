import { z } from 'zod'
import { initTRPC } from '@trpc/server'
import type { Context } from '../context.js'

const t = initTRPC.context<Context>().create()

export const sessionRouter = t.router({
  list: t.procedure.query(({ ctx }) => {
    return ctx.services.sessionService.list()
  }),

  listByProject: t.procedure
    .input(z.object({ projectId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.sessionService.listByProject(input.projectId)
    }),

  get: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.sessionService.get(input.id)
    }),

  create: t.procedure
    .input(z.object({
      projectId: z.string(),
      name: z.string(),
      branch: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      return ctx.services.sessionService.create(
        input.projectId,
        { name: input.name, branch: input.branch }
      )
    }),

  start: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.services.sessionService.start(input.id)
    }),

  stop: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.services.sessionService.stop(input.id)
    }),

  restart: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.services.sessionService.restart(input.id)
    }),

  remove: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.sessionService.remove(input.id)
      return { success: true }
    }),

  logs: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.sessionService.getLogs(input.id)
    }),

  gitStatus: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.id)
      if (!session?.worktree?.path) {
        throw new Error('Session has no worktree')
      }
      return ctx.services.gitService.getStatus(session.worktree.path)
    }),

  gitLog: t.procedure
    .input(z.object({ id: z.string(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.id)
      if (!session?.worktree?.path) {
        throw new Error('Session has no worktree')
      }
      return ctx.services.gitService.getLog(session.worktree.path, input.limit)
    }),

  gitDiff: t.procedure
    .input(z.object({ id: z.string(), staged: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.id)
      if (!session?.worktree?.path) {
        throw new Error('Session has no worktree')
      }
      return ctx.services.gitService.getDiff(session.worktree.path, input.staged)
    }),
})
