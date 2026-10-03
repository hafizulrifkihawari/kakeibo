import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { createQueryClient } from './client/queries'

export interface RouterContext {
  queryClient: QueryClient
}

// One QueryClient per browser tab; a fresh one per server request.
let browserClient: QueryClient | undefined

export function getRouter() {
  const queryClient =
    typeof window === 'undefined' ? createQueryClient() : (browserClient ??= createQueryClient())

  return createTanStackRouter({
    routeTree,
    context: { queryClient } satisfies RouterContext,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
