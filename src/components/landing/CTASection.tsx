import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CTASection() {
  return (
    <section className="py-24 lg:py-32 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Ready to build something amazing?
          </h2>
          <p className="text-lg md:text-xl opacity-90 mb-10">
            Join thousands of developers who are shipping faster with our
            starter template. Get started in minutes, not weeks.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button
                size="lg"
                variant="secondary"
                className="min-w-[180px] group"
              >
                Start Building Free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="min-w-[180px] bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                View Pricing
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
