import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@claude-sandbox/server/src/trpc/router'

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/trpc',
    }),
  ],
})
