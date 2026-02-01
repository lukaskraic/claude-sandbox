import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc: any = createTRPCProxyClient({
  links: [
    httpBatchLink({
      url: '/trpc',
    }),
  ],
})
