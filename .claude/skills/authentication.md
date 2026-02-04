# Authentication Skill

This skill covers authentication patterns using Better-Auth in this TanStack Start project.

## Better-Auth Overview

This project uses [Better-Auth](https://better-auth.com) for authentication with:

- Email/password authentication
- Google OAuth (optional)
- Session management with database storage
- Role-based access control (RBAC)

## Configuration

### Server Configuration

```typescript
// src/lib/auth.ts
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '../db'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
        input: false, // Cannot be set by user during signup
      },
      stripeCustomerId: {
        type: 'string',
        required: false,
      },
      subscriptionStatus: {
        type: 'string',
        required: false,
      },
    },
  },
})
```

### Client Configuration

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react'

export const { signIn, signUp, signOut, useSession, getSession } =
  createAuthClient({
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  })
```

### Environment Variables

```env
# Required
BETTER_AUTH_SECRET="your-secret-key-at-least-32-characters"
BETTER_AUTH_URL="http://localhost:3000"

# Optional - Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

## Server Middleware

### Auth Middleware (Requires Authentication)

```typescript
// src/server/middleware.ts
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/start-server-core'
import { auth } from '../lib/auth'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  emailVerified: boolean
  role: string
  stripeCustomerId?: string | null
  subscriptionStatus?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AuthSession {
  id: string
  userId: string
  expiresAt: Date
  token: string
  ipAddress?: string | null
  userAgent?: string | null
}

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    throw new Error('Unauthorized')
  }

  return next({
    context: {
      user: session.user as AuthUser,
      session: session.session as AuthSession,
    },
  })
})
```

### Admin Middleware (Requires Admin Role)

```typescript
export const adminMiddleware = createMiddleware()
  .middleware([authMiddleware]) // Extends authMiddleware
  .server(async ({ next, context }) => {
    if (context.user.role !== 'admin') {
      throw new Error('Forbidden: Admins only')
    }
    return next()
  })
```

### Optional Auth Middleware (User May Be Null)

```typescript
export const optionalAuthMiddleware = createMiddleware().server(
  async ({ next }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    return next({
      context: {
        user: (session?.user as AuthUser | undefined) ?? null,
        session: (session?.session as AuthSession | undefined) ?? null,
      },
    })
  },
)
```

## Getting Session Data

### Server Function for Session

```typescript
// src/server/auth.fn.ts
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/start-server-core'
import { auth } from '../lib/auth'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    return session
  },
)
```

### Client-Side Session Hook

```typescript
import { useSession } from '@/lib/auth-client'

function MyComponent() {
  const { data: session, isPending } = useSession()

  if (isPending) return <div>Loading...</div>
  if (!session) return <div>Not logged in</div>

  return <div>Hello, {session.user.name}</div>
}
```

## Authentication Actions

### Sign Up

```typescript
// Client-side
import { signUp } from '@/lib/auth-client'

const handleSignUp = async (email: string, password: string, name: string) => {
  const result = await signUp.email({
    email,
    password,
    name,
  })

  if (result.error) {
    setError(result.error.message)
    return
  }

  // Success - redirect to app
  window.location.href = '/dashboard'
}
```

### Sign In (Email/Password)

```typescript
import { signIn } from '@/lib/auth-client'

const handleSignIn = async (email: string, password: string) => {
  const result = await signIn.email({
    email,
    password,
  })

  if (result.error) {
    setError(result.error.message || 'Invalid credentials')
    return
  }

  await router.invalidate()
  window.location.href = '/dashboard'
}
```

### Sign In (Google OAuth)

```typescript
import { signIn } from '@/lib/auth-client'

const handleGoogleSignIn = async () => {
  await signIn.social({
    provider: 'google',
    callbackURL: '/dashboard',
  })
}
```

### Sign Out

```typescript
import { signOut } from '@/lib/auth-client'

const handleSignOut = async () => {
  await signOut()
  window.location.href = '/'
}
```

## Protecting Routes

### Layout-Level Protection

```typescript
// src/routes/_app.tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { getSessionFn } from '@/server/auth.fn'

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

function AppLayout() {
  const { user } = Route.useRouteContext()
  // user is guaranteed to exist here
  return <Outlet />
}
```

### Role-Based Route Protection

```typescript
// src/routes/_app/admin.tsx
export const Route = createFileRoute('/_app/admin')({
  beforeLoad: ({ context }) => {
    if (context.user?.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminPage,
})
```

### Protecting Server Functions

```typescript
// For authenticated users
export const getUserDataFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // context.user is available and typed
    return await prisma.user.findUnique({
      where: { id: context.user.id },
    })
  })

// For admins only
export const listAllUsersFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async () => {
    return await prisma.user.findMany()
  })
```

## Role-Based Access Control

### Checking Roles in Components

```typescript
function Navigation() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  return (
    <nav>
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/profile">Profile</Link>
      {isAdmin && <Link to="/admin">Admin</Link>}
    </nav>
  )
}
```

### Updating User Roles (Admin Only)

```typescript
// src/server/auth.fn.ts
const updateRoleSchema = z.object({
  userId: z.string(),
  role: z.enum(['user', 'admin']),
})

export const updateUserRoleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateRoleSchema)
  .handler(async ({ data, context }) => {
    // Only admins can change roles
    if (context.user.role !== 'admin') {
      throw new Error('Forbidden: Admins only')
    }

    // Prevent self-demotion
    if (data.userId === context.user.id && data.role !== 'admin') {
      throw new Error('Cannot demote yourself')
    }

    await prisma.user.update({
      where: { id: data.userId },
      data: { role: data.role },
    })

    return { success: true }
  })
```

## User Database Schema

```prisma
// prisma/schema.prisma
model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  emailVerified      Boolean   @default(false)
  name               String?
  image              String?
  role               String    @default("user")  // "user" | "admin"
  stripeCustomerId   String?
  subscriptionStatus String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  sessions           Session[]
  accounts           Account[]

  @@map("user")
}
```

## API Handler

Better-Auth requires an API route to handle all auth requests:

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

### "Unauthorized" in Server Functions

**Cause**: User not logged in or session expired.

**Solutions**:

1. Check route protection redirects to login
2. Verify `authMiddleware` is in the middleware chain
3. Check cookies are being sent with requests

### Session Not Persisting

**Cause**: Cookie issues or auth configuration.

**Solutions**:

1. Verify `BETTER_AUTH_URL` matches your app URL
2. Check `BETTER_AUTH_SECRET` is set and consistent
3. Ensure database has `Session` table (run `npm run db:push`)

### Google OAuth Not Working

**Cause**: Missing or incorrect OAuth configuration.

**Solutions**:

1. Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
2. Verify callback URL in Google Console: `http://localhost:3000/api/auth/callback/google`
3. Ensure Google+ API is enabled in Google Cloud Console

### Role Changes Not Reflecting

**Cause**: Session cache or stale data.

**Solution**: Invalidate queries after role change:

```typescript
const mutation = useMutation({
  mutationFn: updateUserRoleFn,
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  },
})
```

### "Invalid credentials" on Login

**Cause**: Wrong password or user doesn't exist.

**Solutions**:

1. Check user exists in database (use Prisma Studio: `npm run db:studio`)
2. Verify password meets requirements (min 8 characters)
3. Check for typos in email

## File References

- Server auth config: `src/lib/auth.ts`
- Client auth hooks: `src/lib/auth-client.ts`
- Middleware: `src/server/middleware.ts`
- Auth functions: `src/server/auth.fn.ts`
- Auth actions: `src/server/auth.actions.ts`
- API handler: `src/routes/api/auth/$.ts`
- User schema: `prisma/schema.prisma`
