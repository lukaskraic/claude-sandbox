import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { t, publicProcedure } from '../trpc.js'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export const authRouter = t.router({
  login: publicProcedure
    .input(z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { authService } = ctx.services

      if (!authService.hasUsers()) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication not configured',
        })
      }

      const valid = authService.validateCredentials(input.username, input.password)

      if (!valid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password',
        })
      }

      const sessionId = authService.createSession(input.username)

      ctx.res.cookie('session_id', sessionId, COOKIE_OPTIONS)

      return { success: true, username: input.username }
    }),

  logout: publicProcedure
    .mutation(async ({ ctx }) => {
      const sessionId = ctx.res.req.cookies?.session_id

      if (sessionId) {
        ctx.services.authService.deleteSession(sessionId)
      }

      ctx.res.clearCookie('session_id', COOKIE_OPTIONS)

      return { success: true }
    }),

  me: publicProcedure
    .query(async ({ ctx }) => {
      return {
        user: ctx.user,
        authRequired: ctx.services.authService.hasUsers(),
      }
    }),
})
