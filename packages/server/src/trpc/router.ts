import { initTRPC } from '@trpc/server'
import type { Context } from './context.js'
import { projectRouter } from './routers/projectRouter.js'
import { sessionRouter } from './routers/sessionRouter.js'

const t = initTRPC.context<Context>().create()

export const appRouter = t.router({
  project: projectRouter,
  session: sessionRouter,
})

export type AppRouter = typeof appRouter
