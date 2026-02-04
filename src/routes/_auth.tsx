import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '../server/auth.fn'

/**
 * Auth Layout
 * Centered layout for authentication pages (login, signup)
 * Redirects to dashboard if already authenticated
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (session?.user) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <Outlet />
    </div>
  )
}
