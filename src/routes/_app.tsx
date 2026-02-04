import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { getSessionFn } from '../server/auth.fn'
import { signOut, useSession } from '../lib/auth-client'
import { Button } from '../components/ui/button'

// Type for the user from Better-Auth session
interface AppUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  emailVerified: boolean
  role?: string
}

/**
 * Protected App Layout
 * Requires authentication - redirects to login if not authenticated
 * Includes sidebar navigation and user dropdown
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
    return { user: session.user as AppUser }
  },
  component: AppLayout,
})

function AppLayout() {
  const routeContext = Route.useRouteContext()
  const navigate = useNavigate()
  const { data: session } = useSession()

  // User from session takes precedence, fallback to route context
  const sessionUser = session?.user as AppUser | undefined
  const user = sessionUser ?? routeContext.user
  const userName = user.name || 'User'
  const userEmail = user.email
  const userRole = user.role

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/' })
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-muted/30 md:block">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center border-b px-6">
            <Link to="/" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary" />
              <span className="text-xl font-bold">AppStarter</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            <NavLink to="/dashboard" icon="📊">
              Dashboard
            </NavLink>
            <NavLink to="/profile" icon="👤">
              Profile
            </NavLink>
            {userRole === 'admin' && (
              <NavLink to="/admin" icon="⚙️">
                Admin
              </NavLink>
            )}
          </nav>

          {/* User Section */}
          <div className="border-t p-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {userEmail}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full justify-start"
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between border-b px-4 md:hidden">
          <Link to="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <span className="text-xl font-bold">AppStarter</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavLink({
  to,
  icon,
  children,
}: {
  to: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
    >
      <span>{icon}</span>
      <span>{children}</span>
    </Link>
  )
}
