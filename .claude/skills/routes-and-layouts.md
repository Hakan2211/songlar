# Routes and Layouts Skill

This skill covers TanStack Router file-based routing, layouts, and data loading patterns.

## File-Based Routing Conventions

Routes are defined in `src/routes/` using TanStack Router's file-based convention.

### Route File Types

| Pattern       | Purpose                          | Example                               |
| ------------- | -------------------------------- | ------------------------------------- |
| `__root.tsx`  | Root layout for entire app       | HTML shell, providers, devtools       |
| `index.tsx`   | Index route for a path           | `/` renders `routes/index.tsx`        |
| `_layout.tsx` | Layout route (prefixed with `_`) | `_app.tsx` wraps `_app/*.tsx` routes  |
| `$param.tsx`  | Dynamic route segment            | `$userId.tsx` for `/users/:userId`    |
| `$.tsx`       | Catch-all route                  | `api/auth/$.ts` catches `/api/auth/*` |

### Current Route Structure

```
src/routes/
├── __root.tsx          # Root layout (HTML shell, Toaster, DevTools)
├── index.tsx           # Landing page (/)
├── pricing.tsx         # Pricing page (/pricing)
├── _auth.tsx           # Auth layout (login/signup wrapper)
├── _auth/
│   ├── login.tsx       # Login page (/login)
│   └── signup.tsx      # Signup page (/signup)
├── _app.tsx            # Protected app layout (requires auth)
├── _app/
│   ├── dashboard.tsx   # Dashboard (/dashboard)
│   ├── profile.tsx     # Profile (/profile)
│   └── admin.tsx       # Admin panel (/admin)
└── api/
    └── auth/
        └── $.ts        # Better-Auth API handler (/api/auth/*)
```

## Creating Routes

### Basic Page Route

```typescript
// src/routes/about.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return (
    <div>
      <h1>About Us</h1>
    </div>
  )
}
```

### Route with Head/Meta

```typescript
export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'About Us - My App' },
      { name: 'description', content: 'Learn more about our company' },
    ],
  }),
  component: AboutPage,
})
```

## Layout Patterns

### Root Layout (`__root.tsx`)

The root layout wraps the entire application and handles the HTML document structure.

```typescript
// src/routes/__root.tsx
import { createRootRouteWithContext, Outlet, HeadContent, Scripts } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import appCss from '../styles.css?url'

// Define router context type
interface MyRouterContext {
  user?: { id: string; email: string; role: string }
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  return <Outlet />  // Child routes render here
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster position="bottom-right" richColors />
        <Scripts />
      </body>
    </html>
  )
}
```

### Layout Routes (Underscore Prefix)

Layout routes use the `_` prefix and wrap child routes.

```typescript
// src/routes/_app.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getSessionFn } from '@/server/auth.fn'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
    return { user: session.user }  // Available in child routes via context
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 border-r md:block">
        <nav>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/profile">Profile</Link>
          {user.role === 'admin' && <Link to="/admin">Admin</Link>}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">
        <Outlet />  {/* Child routes render here */}
      </main>
    </div>
  )
}
```

### Child Routes Under Layouts

```typescript
// src/routes/_app/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  // Access parent context
  const { user } = Route.useRouteContext()

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
    </div>
  )
}
```

## Protected Routes with `beforeLoad`

### Basic Authentication Check

```typescript
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
    return { user: session.user }
  },
  component: AppLayout,
})
```

### Role-Based Protection

```typescript
// src/routes/_app/admin.tsx
export const Route = createFileRoute('/_app/admin')({
  beforeLoad: ({ context }) => {
    // Access user from parent layout context
    if (context.user?.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminPage,
})
```

### Redirect Authenticated Users (Auth Pages)

```typescript
// src/routes/_auth.tsx
export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (session?.user) {
      // Already logged in, redirect to app
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AuthLayout,
})
```

### Redirect with Search Params

```typescript
beforeLoad: async ({ location }) => {
  const session = await getSessionFn()
  if (!session?.user) {
    throw redirect({
      to: '/login',
      search: { redirect: location.pathname },
    })
  }
  return { user: session.user }
}
```

## Route Context

### Setting Context in `beforeLoad`

```typescript
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session?.user) throw redirect({ to: '/login' })

    // Return data to make it available in context
    return {
      user: session.user,
      permissions: calculatePermissions(session.user),
    }
  },
  component: AppLayout,
})
```

### Accessing Context in Components

```typescript
function AppLayout() {
  // Use the route's typed context
  const { user, permissions } = Route.useRouteContext()

  return <div>Hello {user.name}</div>
}
```

### Accessing Context in Child Routes

```typescript
// src/routes/_app/dashboard.tsx
function DashboardPage() {
  // Context flows from parent routes
  const { user } = Route.useRouteContext()

  return <div>User role: {user.role}</div>
}
```

## Data Loading with TanStack Query

### Query in Component

```typescript
import { useQuery } from '@tanstack/react-query'
import { getItemsFn } from '@/server/items.fn'

function ItemsPage() {
  const { data: items, isLoading, error } = useQuery({
    queryKey: ['items'],
    queryFn: () => getItemsFn(),
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <ul>
      {items?.map((item) => (
        <li key={item.id}>{item.title}</li>
      ))}
    </ul>
  )
}
```

### Mutation with Cache Invalidation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createItemFn, deleteItemFn } from '@/server/items.fn'

function ItemsPage() {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (input: { title: string }) => createItemFn({ data: input }),
    onSuccess: () => {
      // Refetch items list after creating
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteItemFn({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })

  return (
    <button
      onClick={() => createMutation.mutate({ title: 'New Item' })}
      disabled={createMutation.isPending}
    >
      {createMutation.isPending ? 'Creating...' : 'Create'}
    </button>
  )
}
```

### Multiple Queries

```typescript
function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => getStatsFn(),
  })

  const { data: recentActivity } = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => getRecentActivityFn(),
  })

  // Both queries run in parallel
  return (
    <div>
      <StatsSection stats={stats} />
      <ActivitySection activity={recentActivity} />
    </div>
  )
}
```

## Navigation

### Link Component

```typescript
import { Link } from '@tanstack/react-router'

// Basic link
<Link to="/dashboard">Dashboard</Link>

// With active styling
<Link
  to="/dashboard"
  className="text-muted-foreground"
  activeProps={{ className: 'text-foreground font-medium' }}
>
  Dashboard
</Link>

// With params
<Link to="/users/$userId" params={{ userId: '123' }}>
  View User
</Link>

// With search params
<Link to="/items" search={{ page: 2, sort: 'date' }}>
  Page 2
</Link>
```

### Programmatic Navigation

```typescript
import { useNavigate } from '@tanstack/react-router'

function LoginPage() {
  const navigate = useNavigate()

  const handleLogin = async () => {
    await login()
    navigate({ to: '/dashboard' })
  }

  return <button onClick={handleLogin}>Login</button>
}
```

### Router Invalidation (After Auth Changes)

```typescript
import { useRouter } from '@tanstack/react-router'

function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await signOut()
    // Invalidate router to re-run beforeLoad checks
    await router.invalidate()
    window.location.href = '/'  // Full reload for clean state
  }

  return <button onClick={handleLogout}>Logout</button>
}
```

## API Routes

### Catch-All API Handler

```typescript
// src/routes/api/auth/$.ts
import { createAPIFileRoute } from '@tanstack/react-start/api'
import { auth } from '@/lib/auth'

export const APIRoute = createAPIFileRoute('/api/auth/$')({
  GET: ({ request }) => auth.handler(request),
  POST: ({ request }) => auth.handler(request),
})
```

## Troubleshooting

### Redirect Loop

**Cause**: `beforeLoad` keeps redirecting to a page that also redirects.

**Solution**: Check that auth pages don't require auth:

```typescript
// _auth.tsx should redirect TO dashboard if logged in
// _app.tsx should redirect TO login if NOT logged in
```

### Context Not Available

**Cause**: Trying to access context from a route that doesn't have a parent setting it.

**Solution**: Ensure you're using layout routes correctly:

```typescript
// routes/_app.tsx sets context
// routes/_app/dashboard.tsx can access it
// routes/other.tsx CANNOT access _app's context
```

### "beforeLoad is not a function"

**Cause**: Using wrong import or syntax.

**Solution**: Use `createFileRoute`:

```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/path')({
  beforeLoad: async () => { ... },
  component: MyComponent,
})
```

### Hydration Mismatch

**Cause**: Server and client render different content.

**Solution**: Use `ClientOnly` wrapper for client-only content:

```typescript
import { ClientOnly } from '@/components/ClientOnly'

<ClientOnly fallback={<Skeleton />}>
  <BrowserOnlyComponent />
</ClientOnly>
```

### Query Not Refetching After Navigation

**Cause**: Query key is the same, so cached data is used.

**Solution**: Include route params in query key:

```typescript
const { data } = useQuery({
  queryKey: ['user', userId], // Changes when userId changes
  queryFn: () => getUserFn({ data: { userId } }),
})
```

## File References

- Root layout: `src/routes/__root.tsx`
- App layout: `src/routes/_app.tsx`
- Auth layout: `src/routes/_auth.tsx`
- Landing page: `src/routes/index.tsx`
- Dashboard: `src/routes/_app/dashboard.tsx`
- Profile: `src/routes/_app/profile.tsx`
- Admin: `src/routes/_app/admin.tsx`
- Auth API: `src/routes/api/auth/$.ts`
