import { motion } from 'framer-motion'
import {
  CreditCard,
  Database,
  Lock,
  Paintbrush,
  Shield,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: Lock,
    title: 'Authentication',
    description:
      'Email/password and OAuth with Better-Auth. Session management and RBAC built-in.',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: CreditCard,
    title: 'Payments',
    description:
      'Stripe integration with subscription management. Mock mode for development.',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    icon: Database,
    title: 'Database',
    description:
      'SQLite with Prisma ORM. Production-ready with Turso/Litestream support.',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: Paintbrush,
    title: 'UI Components',
    description:
      'Shadcn UI with Tailwind CSS. Beautiful, accessible, and customizable.',
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
  },
  {
    icon: Shield,
    title: 'Security',
    description:
      'CSRF protection, honeypot fields, rate limiting, and secure headers.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  {
    icon: Zap,
    title: 'Performance',
    description:
      'Server-side rendering, code splitting, and optimized bundle size.',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 lg:py-32 bg-muted/30">
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
            Everything you need to build
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Pre-configured with best practices and modern tooling so you can
            focus on what matters - your product.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <FeatureCard feature={feature} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ feature }: { feature: (typeof features)[0] }) {
  const Icon = feature.icon

  return (
    <div className="group relative h-full rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      {/* Icon */}
      <div
        className={cn(
          'mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg',
          feature.bgColor,
        )}
      >
        <Icon className={cn('h-6 w-6', feature.color)} />
      </div>

      {/* Content */}
      <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
      <p className="text-muted-foreground">{feature.description}</p>
    </div>
  )
}
