import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '../db'

const authBaseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

export const auth = betterAuth({
  baseURL: authBaseUrl,
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
        input: false,
      },
      stripeCustomerId: {
        type: 'string',
        required: false,
        input: false,
      },
      subscriptionStatus: {
        type: 'string',
        required: false,
        input: false,
      },
      onboardingComplete: {
        type: 'boolean',
        defaultValue: false,
        input: false,
      },
    },
  },
  trustedOrigins: [authBaseUrl],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
