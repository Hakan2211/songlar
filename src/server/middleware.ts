import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/start-server-core'
import { auth } from '../lib/auth'

// Define user type based on Better-Auth with our custom fields
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

/**
 * Authentication Middleware
 * Validates session via Better-Auth and adds user context
 */
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

/**
 * Admin Middleware
 * Extends authMiddleware to check for admin role
 */
export const adminMiddleware = createMiddleware()
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (context.user.role !== 'admin') {
      throw new Error('Forbidden: Admins only')
    }
    return next()
  })

/**
 * Optional Auth Middleware
 * Adds user context if authenticated, but doesn't require it
 */
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
