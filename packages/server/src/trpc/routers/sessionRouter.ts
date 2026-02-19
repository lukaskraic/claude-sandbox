import { z } from 'zod'
import { t, protectedProcedure } from '../trpc.js'

export const sessionRouter = t.router({
  claudeSourceUsers: protectedProcedure.query(({ ctx }) => {
    return ctx.config.claudeSourceUsers
  }),

  list: protectedProcedure.query(({ ctx }) => {
    return ctx.services.sessionService.list()
  }),

  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.sessionService.listByProject(input.projectId)
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.sessionService.get(input.id)
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string(),
      branch: z.string().optional(),
      worktreePath: z.string().optional(),
      claudeSourceUser: z.string().optional(),
      gitUserName: z.string().optional(),
      gitUserEmail: z.string().optional(),
      githubToken: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      return ctx.services.sessionService.create(
        input.projectId,
        {
          name: input.name,
          branch: input.branch,
          worktreePath: input.worktreePath,
          claudeSourceUser: input.claudeSourceUser,
          gitUserName: input.gitUserName,
          gitUserEmail: input.gitUserEmail,
          githubToken: input.githubToken,
        }
      )
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.services.sessionService.start(input.id)
    }),

  stop: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.services.sessionService.stop(input.id)
    }),

  restart: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.services.sessionService.restart(input.id)
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.sessionService.remove(input.id)
      return { success: true }
    }),

  logs: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.sessionService.getLogs(input.id)
    }),

  gitStatus: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.id)
      if (!session?.worktree?.path) {
        throw new Error('Session has no worktree')
      }
      return ctx.services.gitService.getStatus(session.worktree.path)
    }),

  gitLog: protectedProcedure
    .input(z.object({ id: z.string(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.id)
      if (!session?.worktree?.path) {
        throw new Error('Session has no worktree')
      }
      return ctx.services.gitService.getLog(session.worktree.path, input.limit)
    }),

  gitDiff: protectedProcedure
    .input(z.object({ id: z.string(), staged: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.id)
      if (!session?.worktree?.path) {
        throw new Error('Session has no worktree')
      }
      return ctx.services.gitService.getDiff(session.worktree.path, input.staged)
    }),

  gitPull: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.id)
      if (!session?.worktree?.path) {
        throw new Error('Session has no worktree')
      }
      await ctx.services.gitService.pull(session.worktree.path)
      return { success: true }
    }),

  gitFetch: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.id)
      if (!session?.worktree?.path) {
        throw new Error('Session has no worktree')
      }
      // Fetch in the worktree context
      await ctx.services.gitService.fetch(session.worktree.path)
      return { success: true }
    }),
})
