import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '../components/AuthForm'

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): { reset?: boolean } => (s.reset ? { reset: true } : {}),
  component: Login,
})

function Login() {
  const { reset } = Route.useSearch()
  return <AuthForm mode="login" notice={reset ? 'Your password was changed. Log in with the new password.' : undefined} />
}
