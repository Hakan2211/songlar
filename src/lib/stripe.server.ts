import Stripe from 'stripe'
import { prisma } from '../db'

/**
 * Stripe Adapter Pattern
 * - When MOCK_PAYMENTS=true or no STRIPE_SECRET_KEY, returns mock responses
 * - This allows development without Stripe credentials
 */

const MOCK_PAYMENTS = process.env.MOCK_PAYMENTS === 'true'

// Initialize Stripe only if we have a key and not in mock mode
function getStripeClient(): Stripe | null {
  if (MOCK_PAYMENTS) return null
  if (!process.env.STRIPE_SECRET_KEY) return null
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

export interface CheckoutResult {
  url: string
}

export interface SubscriptionStatus {
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'none'
  plan: string | null
  hasPlatformAccess: boolean
}

export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<CheckoutResult> {
  const stripe = getStripeClient()

  if (!stripe) {
    console.log(`[MOCK STRIPE] Created checkout session for user: ${userId}`)
    return { url: `${successUrl}?session_id=mock_session_${Date.now()}` }
  }

  // Get or create Stripe customer
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  let customerId = user.stripeCustomerId

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId },
    })
    customerId = customer.id

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    })
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
  })

  if (!session.url) {
    throw new Error('Failed to create checkout session')
  }

  return { url: session.url }
}

export async function getSubscriptionStatus(
  userId: string,
): Promise<SubscriptionStatus> {
  const stripe = getStripeClient()

  if (!stripe) {
    // In mock mode, always return active with platform access
    return { status: 'active', plan: 'pro', hasPlatformAccess: true }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      hasPlatformAccess: true,
    },
  })

  if (!user?.subscriptionStatus) {
    return {
      status: 'none',
      plan: null,
      hasPlatformAccess: user?.hasPlatformAccess ?? false,
    }
  }

  return {
    status: user.subscriptionStatus as SubscriptionStatus['status'],
    plan: user.subscriptionStatus === 'active' ? 'pro' : null,
    hasPlatformAccess: user.hasPlatformAccess,
  }
}

export async function handleWebhook(
  payload: string,
  signature: string,
): Promise<{ received: boolean }> {
  const stripe = getStripeClient()

  if (!stripe) {
    console.log('[MOCK STRIPE] Webhook received')
    return { received: true }
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook secret not configured')
  }

  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET,
  )

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata?.userId
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: 'active',
            hasPlatformAccess: true,
            platformPurchaseDate: new Date(),
            platformStripePaymentId: session.payment_intent as string | null,
          },
        })
      }
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const customer = subscription.customer
      const customerId = typeof customer === 'string' ? customer : customer.id
      if (customerId) {
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: 'canceled' },
          })
        }
      }
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object
      const invoiceCustomer = invoice.customer
      if (!invoiceCustomer) break
      const customerId =
        typeof invoiceCustomer === 'string'
          ? invoiceCustomer
          : invoiceCustomer.id
      if (customerId) {
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: 'past_due' },
          })
        }
      }
      break
    }
  }

  return { received: true }
}

export async function createBillingPortalSession(
  userId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripeClient()

  if (!stripe) {
    console.log(`[MOCK STRIPE] Created billing portal for user: ${userId}`)
    return { url: returnUrl }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.stripeCustomerId) {
    throw new Error('No Stripe customer found for user')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  })

  return { url: session.url }
}
