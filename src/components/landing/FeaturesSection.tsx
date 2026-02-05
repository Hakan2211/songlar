import { motion } from 'framer-motion'
import { Download, Infinity, Key, Lock, Mic2, Music } from 'lucide-react'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: Key,
    title: 'Bring Your Own Key',
    description:
      'Use your own fal.ai and MiniMax API keys. No middleman markup, direct access to AI providers.',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: Music,
    title: 'ElevenLabs Music',
    description:
      'Generate professional instrumental and vocal music from text descriptions. Perfect for any style.',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    icon: Mic2,
    title: 'MiniMax Music',
    description:
      'Create music with your own lyrics using reference tracks. Full control over vocals and style.',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: Lock,
    title: 'Secure & Private',
    description:
      'Your API keys are encrypted with AES-256-GCM. We never store or see your keys in plaintext.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  {
    icon: Download,
    title: 'Download & Own',
    description:
      'Download your generated music as MP3. Full ownership of everything you create.',
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
  },
  {
    icon: Infinity,
    title: 'Unlimited Generations',
    description:
      'No generation limits from us. Only pay for what you use directly to AI providers.',
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
            Powerful AI Music Generation
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Access cutting-edge AI music models with your own API keys. No
            subscriptions, no per-generation fees from us.
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
