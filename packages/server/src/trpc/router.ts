import { t } from './trpc.js'
import { projectRouter } from './routers/projectRouter.js'
import { sessionRouter } from './routers/sessionRouter.js'
import { fileRouter } from './routers/fileRouter.js'
import { containerRouter } from './routers/containerRouter.js'
import { authRouter } from './routers/authRouter.js'
import { worktreeRouter } from './routers/worktreeRouter.js'

export const appRouter = t.router({
  auth: authRouter,
  project: projectRouter,
  session: sessionRouter,
  file: fileRouter,
  container: containerRouter,
  worktree: worktreeRouter,
})

export type AppRouter = typeof appRouter
