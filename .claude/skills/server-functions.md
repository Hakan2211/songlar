# Server Functions Skill

This skill covers creating server functions, actions, and services in this TanStack Start project.

## File Naming Conventions

| Pattern         | Purpose                                    | Location                   |
| --------------- | ------------------------------------------ | -------------------------- |
| `*.fn.ts`       | Server functions (queries and mutations)   | `src/server/`              |
| `*.actions.ts`  | Server actions (focused on auth/mutations) | `src/server/`              |
| `middleware.ts` | Shared middleware definitions              | `src/server/middleware.ts` |
| `*.service.ts`  | External service integrations              | `src/server/services/`     |

### When to Use Each Pattern

- **`*.fn.ts`**: Use for data fetching functions and general mutations (e.g., `billing.fn.ts`, `user.fn.ts`)
- **`*.actions.ts`**: Use for authentication-related actions like sign-in, sign-out, sign-up
- **`*.service.ts`**: Use for third-party API integrations (Stripe, email providers, etc.)

## Creating Server Functions

Server functions use TanStack Start's `createServerFn` with a fluent/chainable API.

### Basic Structure (No Auth Required)

```typescript
// src/server/example.fn.ts
import { createServerFn } from '@tanstack/react-start'

export const getPublicDataFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    // No authentication required
    return { data: 'public data' }
  },
)
```

### With Authentication Middleware

```typescript
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './middleware'
import { prisma } from '../db'

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
})

export const updateProfileFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware]) // Step 1: Add middleware
  .inputValidator(updateProfileSchema) // Step 2: Validate input with Zod
  .handler(async ({ data, context }) => {
    // Step 3: Handler with typed data/context
    const user = await prisma.user.update({
      where: { id: context.user.id },
      data: {
        name: data.name,
        image: data.image,
      },
    })
    return { success: true, user }
  })
```

### Chaining Order

Always follow this order when chaining:

```typescript
createServerFn({ method: 'GET' | 'POST' })
  .middleware([...])        // Optional: Add middleware array
  .inputValidator(schema)   // Optional: Zod schema for input validation
  .handler(async ({ data, context }) => {
    // data: Validated input (from inputValidator)
    // context: Data from middleware (e.g., context.user)
  })
```

## Creating Middleware

Middleware uses `createMiddleware` from TanStack Start and provides context to handlers.

### Basic Auth Middleware Pattern

```typescript
// src/server/middleware.ts
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/start-server-core'
import { auth } from '../lib/auth'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: string
  // Add other fields as needed
}

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    throw new Error('Unauthorized')
  }

  // Pass user to handler via context
  return next({
    context: {
      user: session.user as AuthUser,
      session: session.session,
    },
  })
})
```

### Admin Middleware (Extends Auth)

```typescript
export const adminMiddleware = createMiddleware()
  .middleware([authMiddleware]) // Chain from authMiddleware
  .server(async ({ next, context }) => {
    // context.user is already available from authMiddleware
    if (context.user.role !== 'admin') {
      throw new Error('Forbidden: Admins only')
    }
    return next() // Context passes through automatically
  })
```

### Optional Auth Middleware

```typescript
export const optionalAuthMiddleware = createMiddleware().server(
  async ({ next }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    return next({
      context: {
        user: session?.user ?? null,
        session: session?.session ?? null,
      },
    })
  },
)
```

## Input Validation with Zod

### Common Schema Patterns

```typescript
import { z } from 'zod'

// Required fields
const createItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
})

// Optional fields with defaults handled in handler
const listItemsSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
})

// Enum validation
const updateRoleSchema = z.object({
  userId: z.string(),
  role: z.enum(['user', 'admin']),
})

// Email and password
const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
```

### Using Validation in Functions

```typescript
export const createItemFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createItemSchema)
  .handler(async ({ data, context }) => {
    // data.title is guaranteed to exist and be valid
    // data.description may be undefined
    const item = await prisma.item.create({
      data: {
        title: data.title,
        description: data.description,
        userId: context.user.id,
      },
    })
    return item
  })
```

## Service Layer Pattern

Services wrap external APIs with mock mode support for development.

### Creating a New Service

```typescript
// src/server/services/email.service.ts

// 1. Mock mode check via environment variable
const MOCK_EMAIL = process.env.MOCK_EMAIL === 'true'

// 2. Type definitions
export interface SendEmailInput {
  to: string
  subject: string
  body: string
}

export interface SendEmailOutput {
  success: boolean
  messageId?: string
}

// 3. Main service function with mock mode branching
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailOutput> {
  if (MOCK_EMAIL) {
    console.log(`[MOCK EMAIL] To: ${input.to}, Subject: ${input.subject}`)
    return mockEmailResponse(input)
  }

  // Real implementation
  const response = await fetch('https://api.emailprovider.com/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error('Failed to send email')
  }

  return await response.json()
}

// 4. Mock implementation
function mockEmailResponse(input: SendEmailInput): SendEmailOutput {
  return {
    success: true,
    messageId: `mock_${Date.now()}`,
  }
}

// 5. Health check helper
export function isEmailServiceAvailable(): boolean {
  if (MOCK_EMAIL) return true
  return !!process.env.EMAIL_API_KEY
}
```

### Registering Services (Barrel Export)

```typescript
// src/server/services/index.ts
export * from './email.service'
export * from './example.service'
// Add new services here
```

### Using Services in Server Functions

```typescript
import { sendEmail } from './services'

export const sendWelcomeEmailFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await sendEmail({
      to: context.user.email,
      subject: 'Welcome!',
      body: 'Thanks for signing up.',
    })
    return { success: true }
  })
```

## Calling Server Functions from Client

### In Route Components

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getItemsFn, createItemFn } from '@/server/items.fn'

function ItemsPage() {
  const queryClient = useQueryClient()

  // Query for fetching data
  const { data: items, isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: () => getItemsFn(),
  })

  // Mutation for creating data
  const createMutation = useMutation({
    mutationFn: (input: { title: string }) => createItemFn({ data: input }),
    onSuccess: () => {
      // Invalidate and refetch
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })

  return (
    <button
      onClick={() => createMutation.mutate({ title: 'New Item' })}
      disabled={createMutation.isPending}
    >
      {createMutation.isPending ? 'Creating...' : 'Create Item'}
    </button>
  )
}
```

### Direct Calls (No Caching)

```typescript
// For one-off calls like auth actions
const result = await signInAction({ data: { email, password } })
```

## Authorization Patterns

### In-Handler Authorization

For complex authorization logic beyond middleware:

```typescript
export const getUserFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data, context }) => {
    // Users can only view themselves unless admin
    if (context.user.role !== 'admin' && context.user.id !== data.userId) {
      throw new Error('Forbidden')
    }

    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    })

    return user
  })
```

### Self-Modification Prevention

```typescript
export const updateUserRoleFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator(updateRoleSchema)
  .handler(async ({ data, context }) => {
    // Prevent admin from demoting themselves
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

## Troubleshooting

### "Unauthorized" Error

**Cause**: User is not logged in or session expired.

**Solution**: Ensure the route is protected and user is redirected to login:

```typescript
// In route beforeLoad
const session = await getSessionFn()
if (!session?.user) {
  throw redirect({ to: '/login' })
}
```

### "oldString not found" When Editing

**Cause**: Trying to edit a server function that doesn't exist yet.

**Solution**: Create the file first, then edit. Use `Write` tool for new files.

### Validation Errors Not Showing

**Cause**: Not handling errors from server function.

**Solution**: Wrap call in try/catch and handle error state:

```typescript
const mutation = useMutation({
  mutationFn: (data) => myFn({ data }),
  onError: (error) => {
    setError(error.message)
  },
})
```

### Context Not Available in Handler

**Cause**: Middleware not added to the chain.

**Solution**: Add middleware before inputValidator:

```typescript
createServerFn({ method: 'POST' })
  .middleware([authMiddleware]) // Must be before handler
  .handler(({ context }) => {
    // context.user now available
  })
```

### Service Not Using Mock Mode

**Cause**: Environment variable not set or not loaded.

**Solution**:

1. Add to `.env.local`: `MOCK_EMAIL=true`
2. Restart dev server to reload env vars

## File References

- Middleware definitions: `src/server/middleware.ts`
- Auth functions: `src/server/auth.fn.ts`
- Auth actions: `src/server/auth.actions.ts`
- Billing functions: `src/server/billing.fn.ts`
- Service layer: `src/server/services/`
- Prisma client: `src/db.ts`
