import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context.js'

export const t = initTRPC.context<Context>().create()

// Middleware to require authentication
const isAuthed = t.middleware(({ ctx, next }) => {
  // Skip auth check if no users configured
  if (!ctx.services.authService.hasUsers()) {
    return next({ ctx })
  }

  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }

  return next({ ctx })
})

export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(isAuthed)
