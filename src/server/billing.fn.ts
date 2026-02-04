import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createBillingPortalSession,
  createCheckoutSession,
  getSubscriptionStatus,
} from '../lib/stripe.server'
import { authMiddleware } from './middleware'

/**
 * Create Stripe Checkout Session
 */
const checkoutSchema = z.object({
  priceId: z.string().optional(),
})

export const createCheckoutFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(checkoutSchema)
  .handler(async ({ data, context }) => {
    const priceId =
      data.priceId || process.env.STRIPE_PRICE_ID || 'price_default'
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    const result = await createCheckoutSession(
      context.user.id,
      priceId,
      `${baseUrl}/dashboard?success=true`,
      `${baseUrl}/pricing?canceled=true`,
    )

    return result
  })

/**
 * Get current user's subscription status
 */
export const getSubscriptionFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const status = await getSubscriptionStatus(context.user.id)
    return status
  })

/**
 * Create Stripe Billing Portal Session
 */
export const createBillingPortalFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    const result = await createBillingPortalSession(
      context.user.id,
      `${baseUrl}/dashboard`,
    )

    return result
  })
