# Payments & Stripe Skill

This skill covers Stripe payment integration with mock mode support in this TanStack Start project.

## Overview

This project uses Stripe for subscription payments with a mock mode for development without Stripe credentials.

| Mode | When to Use                  | Configuration          |
| ---- | ---------------------------- | ---------------------- |
| Mock | Development without Stripe   | `MOCK_PAYMENTS=true`   |
| Real | Production or Stripe testing | Stripe credentials set |

## Environment Variables

```env
# Enable mock mode (set to "true" for development without Stripe)
MOCK_PAYMENTS="true"

# Stripe credentials (required when MOCK_PAYMENTS is not "true")
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Stripe Price IDs for subscription tiers
STRIPE_STARTER_PRICE_ID="price_..."
STRIPE_PRO_PRICE_ID="price_..."
```

## Stripe Server Module

### Basic Structure

```typescript
// src/lib/stripe.server.ts
import Stripe from 'stripe'
import { prisma } from '../db'

const MOCK_PAYMENTS = process.env.MOCK_PAYMENTS === 'true'

// Lazy initialization - only create client when needed
function getStripeClient(): Stripe | null {
  if (MOCK_PAYMENTS) return null
  if (!process.env.STRIPE_SECRET_KEY) return null
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}
```

### Mock Mode Pattern

Every Stripe function should check mock mode first:

```typescript
export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripeClient()

  // Mock mode - return fake success URL
  if (!stripe) {
    console.log(`[MOCK STRIPE] Created checkout session for user: ${userId}`)
    return {
      url: `${successUrl}?session_id=mock_session_${Date.now()}`,
    }
  }

  // Real Stripe implementation
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
    metadata: { userId },
  })

  return { url: session.url! }
}
```

## Server Functions for Payments

### Create Checkout Session

```typescript
// src/server/billing.fn.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './middleware'
import { createCheckoutSession } from '../lib/stripe.server'

const checkoutSchema = z.object({
  priceId: z.string().optional(),
})

export const createCheckoutFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(checkoutSchema)
  .handler(async ({ data, context }) => {
    const priceId = data.priceId || process.env.STRIPE_PRO_PRICE_ID

    if (!priceId) {
      throw new Error('No price ID configured')
    }

    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/profile?checkout=success`
    const cancelUrl = `${baseUrl}/profile?checkout=cancelled`

    const result = await createCheckoutSession(
      context.user.id,
      priceId,
      successUrl,
      cancelUrl,
    )

    return result
  })
```

### Create Billing Portal Session

```typescript
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripeClient()

  // Mock mode
  if (!stripe) {
    console.log(
      `[MOCK STRIPE] Created billing portal for customer: ${customerId}`,
    )
    return { url: returnUrl }
  }

  // Real implementation
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return { url: session.url }
}

// Server function
export const createBillingPortalFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user.stripeCustomerId) {
      throw new Error('No Stripe customer ID')
    }

    const returnUrl = `${process.env.BETTER_AUTH_URL}/profile`

    return await createBillingPortalSession(
      context.user.stripeCustomerId,
      returnUrl,
    )
  })
```

### Get Subscription Status

```typescript
export const getSubscriptionFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // In mock mode, everyone has an active subscription
    if (process.env.MOCK_PAYMENTS === 'true') {
      return {
        status: 'active',
        tier: 'pro',
      }
    }

    return {
      status: context.user.subscriptionStatus || 'inactive',
      tier: context.user.subscriptionStatus === 'active' ? 'pro' : 'free',
    }
  })
```

## Webhook Handling

### Webhook Endpoint

```typescript
// src/routes/api/stripe/webhook.ts
import { createAPIFileRoute } from '@tanstack/react-start/api'
import { handleStripeWebhook } from '@/lib/stripe.server'

export const APIRoute = createAPIFileRoute('/api/stripe/webhook')({
  POST: async ({ request }) => {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return new Response('Missing signature', { status: 400 })
    }

    try {
      await handleStripeWebhook(body, signature)
      return new Response('OK', { status: 200 })
    } catch (error) {
      console.error('Webhook error:', error)
      return new Response('Webhook error', { status: 400 })
    }
  },
})
```

### Webhook Handler

```typescript
// src/lib/stripe.server.ts
import Stripe from 'stripe'
import { prisma } from '../db'

export async function handleStripeWebhook(
  body: string,
  signature: string,
): Promise<void> {
  const stripe = getStripeClient()

  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.log('[MOCK STRIPE] Webhook received')
    return
  }

  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET,
  )

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      await handleCheckoutComplete(session)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      await handleSubscriptionUpdate(subscription)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await handleSubscriptionCancelled(subscription)
      break
    }

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.userId

  if (!userId) {
    console.error('No user ID in checkout session')
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: session.customer as string,
      subscriptionStatus: 'active',
    },
  })

  // Log subscription event
  await prisma.subscriptionEvent.create({
    data: {
      userId,
      event: 'checkout_completed',
      toTier: 'pro',
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
    },
  })
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: subscription.customer as string },
  })

  if (!user) return

  const status = subscription.status === 'active' ? 'active' : 'inactive'

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: status },
  })
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: subscription.customer as string },
  })

  if (!user) return

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: 'cancelled' },
  })

  await prisma.subscriptionEvent.create({
    data: {
      userId: user.id,
      event: 'subscription_cancelled',
      fromTier: 'pro',
      toTier: 'free',
      stripeSubscriptionId: subscription.id,
    },
  })
}
```

## Client-Side Usage

### Checkout Button

```typescript
import { useMutation } from '@tanstack/react-query'
import { createCheckoutFn } from '@/server/billing.fn'
import { Button } from '@/components/ui/button'

function UpgradeButton() {
  const checkoutMutation = useMutation({
    mutationFn: () => createCheckoutFn({ data: {} }),
    onSuccess: (result) => {
      // Redirect to Stripe Checkout
      window.location.href = result.url
    },
    onError: (error) => {
      console.error('Checkout error:', error)
    },
  })

  return (
    <Button
      onClick={() => checkoutMutation.mutate()}
      disabled={checkoutMutation.isPending}
    >
      {checkoutMutation.isPending ? 'Loading...' : 'Upgrade to Pro'}
    </Button>
  )
}
```

### Billing Portal Button

```typescript
import { createBillingPortalFn } from '@/server/billing.fn'

function ManageSubscriptionButton() {
  const portalMutation = useMutation({
    mutationFn: () => createBillingPortalFn(),
    onSuccess: (result) => {
      window.location.href = result.url
    },
  })

  return (
    <Button
      variant="outline"
      onClick={() => portalMutation.mutate()}
      disabled={portalMutation.isPending}
    >
      Manage Subscription
    </Button>
  )
}
```

### Subscription Status Display

```typescript
import { useQuery } from '@tanstack/react-query'
import { getSubscriptionFn } from '@/server/billing.fn'

function SubscriptionStatus() {
  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => getSubscriptionFn(),
  })

  return (
    <div>
      <p>Status: {subscription?.status || 'Loading...'}</p>
      <p>Tier: {subscription?.tier || 'Free'}</p>
    </div>
  )
}
```

### Handle Checkout Success/Cancel

```typescript
// In profile page or checkout callback
import { useSearch } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'

function ProfilePage() {
  const search = useSearch({ from: '/_app/profile' })

  useEffect(() => {
    if (search.checkout === 'success') {
      toast.success('Subscription activated!')
    } else if (search.checkout === 'cancelled') {
      toast.info('Checkout cancelled')
    }
  }, [search.checkout])

  return <div>...</div>
}
```

## Subscription Event Logging

Track all subscription changes for auditing:

```typescript
// Create event after any subscription change
await prisma.subscriptionEvent.create({
  data: {
    userId,
    event: 'upgraded', // or 'downgraded', 'cancelled', 'reactivated'
    fromTier: 'starter',
    toTier: 'pro',
    stripeSubscriptionId,
    stripeCustomerId,
    metadata: JSON.stringify({ reason: 'user_initiated' }),
  },
})

// Query subscription history
const history = await prisma.subscriptionEvent.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' },
  take: 10,
})
```

## Testing with Stripe CLI

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
```

## Troubleshooting

### Mock Mode Not Working

**Cause**: Environment variable not set or dev server not restarted.

**Solution**:

1. Add `MOCK_PAYMENTS=true` to `.env.local`
2. Restart dev server: `npm run dev`

### "No Stripe customer ID"

**Cause**: User hasn't completed checkout yet.

**Solution**: Only show "Manage Subscription" button if user has `stripeCustomerId`:

```typescript
{user.stripeCustomerId && <ManageSubscriptionButton />}
```

### Webhook Signature Verification Failed

**Cause**: Wrong webhook secret or body parsing issue.

**Solution**:

1. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
2. Ensure webhook endpoint receives raw body (not parsed JSON)
3. Use Stripe CLI for local testing

### Subscription Status Not Updating

**Cause**: Webhook not reaching server or database update failing.

**Solution**:

1. Check webhook endpoint logs
2. Verify user lookup by `stripeCustomerId`
3. Use Prisma Studio to check database state

### Checkout Redirects to Wrong URL

**Cause**: `BETTER_AUTH_URL` not set correctly.

**Solution**:

```env
BETTER_AUTH_URL="http://localhost:3000"  # Development
BETTER_AUTH_URL="https://your-domain.com"  # Production
```

## File References

- Stripe server module: `src/lib/stripe.server.ts`
- Billing functions: `src/server/billing.fn.ts`
- Webhook endpoint: `src/routes/api/stripe/webhook.ts` (create if needed)
- User model with Stripe fields: `prisma/schema.prisma`
- SubscriptionEvent model: `prisma/schema.prisma`
