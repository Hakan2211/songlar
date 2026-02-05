import { motion } from 'framer-motion'
import { Download, Key, Music } from 'lucide-react'

const steps = [
  {
    icon: Key,
    title: 'Add Your API Keys',
    description:
      'Sign up and add your fal.ai API key in settings. Your keys are encrypted and stored securely.',
    step: '01',
  },
  {
    icon: Music,
    title: 'Generate Music',
    description:
      'Describe your music or write lyrics. Choose between ElevenLabs or MiniMax models and hit generate.',
    step: '02',
  },
  {
    icon: Download,
    title: 'Download & Use',
    description:
      'Listen to your generated tracks, download as MP3, and use them however you want. You own it.',
    step: '03',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 lg:py-32">
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
            How it works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start creating AI music in three simple steps.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="relative"
            >
              <StepCard step={step} isLast={index === steps.length - 1} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StepCard({
  step,
  isLast,
}: {
  step: (typeof steps)[0]
  isLast: boolean
}) {
  const Icon = step.icon

  return (
    <div className="relative text-center">
      {/* Connector line (hidden on mobile and last item) */}
      {!isLast && (
        <div className="hidden md:block absolute top-12 left-[calc(50%+40px)] w-[calc(100%-80px)] h-0.5 bg-border" />
      )}

      {/* Step number */}
      <div className="relative z-10 mb-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-muted border-4 border-background shadow-lg">
          <Icon className="h-10 w-10 text-primary" />
        </div>
        <span className="absolute -top-2 -right-2 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
          {step.step}
        </span>
      </div>

      {/* Content */}
      <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
      <p className="text-muted-foreground">{step.description}</p>
    </div>
  )
}
