import { z } from 'zod'
import { t, protectedProcedure } from '../trpc.js'

export const worktreeRouter = t.router({
  list: protectedProcedure.query(({ ctx }) => {
    return ctx.services.worktreeService.listAll()
  }),

  listAvailable: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.worktreeService.listAvailable(input.projectId)
    }),

  delete: protectedProcedure
    .input(z.object({
      worktreePath: z.string(),
      cleanClaudeState: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.worktreeService.deleteWorktree(input.worktreePath, input.cleanClaudeState)
      return { success: true }
    }),
})
