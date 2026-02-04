import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const plans = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for trying out the platform',
    features: [
      'Basic features',
      'Community support',
      'Up to 100 requests/day',
      'Email support',
    ],
    cta: 'Get Started',
    href: '/signup',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For professionals and growing teams',
    features: [
      'Everything in Free',
      'Unlimited requests',
      'Priority support',
      'Advanced analytics',
      'API access',
      'Custom integrations',
    ],
    cta: 'Start Free Trial',
    href: '/signup',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations with specific needs',
    features: [
      'Everything in Pro',
      'Dedicated support',
      'Custom SLA',
      'On-premise deployment',
      'SSO/SAML',
      'Audit logs',
    ],
    cta: 'Contact Sales',
    href: '/pricing',
    popular: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that works best for you. All plans include a 14-day
            free trial.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <PricingCard plan={plan} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingCard({ plan }: { plan: (typeof plans)[0] }) {
  return (
    <div
      className={cn(
        'relative h-full rounded-xl border bg-card p-6 shadow-sm',
        plan.popular && 'border-primary shadow-lg scale-105',
      )}
    >
      {/* Popular badge */}
      {plan.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
          Most Popular
        </span>
      )}

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">{plan.price}</span>
          {plan.period && (
            <span className="text-muted-foreground">{plan.period}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-3">
            <Check className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link to={plan.href} className="block">
        <Button
          className="w-full"
          variant={plan.popular ? 'default' : 'outline'}
        >
          {plan.cta}
        </Button>
      </Link>
    </div>
  )
}
