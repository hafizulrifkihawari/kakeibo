import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { fetchMe, keys } from '../client/queries'
import { OfflineBanner } from '../components/bits'
import { TabBar } from '../components/TabBar'

// Signed-in area. It renders on the client only, so the offline cache in IndexedDB is the
// first thing the user sees, also with no network.
export const Route = createFileRoute('/_app')({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery({ queryKey: keys.me, queryFn: fetchMe, staleTime: 5 * 60_000 })
    if (!me) throw redirect({ to: '/login' })
    return { me }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <>
      <OfflineBanner />
      <Outlet />
      <TabBar />
    </>
  )
}
