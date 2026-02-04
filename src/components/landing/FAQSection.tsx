import { motion } from 'framer-motion'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'What is included in the starter template?',
    answer:
      'The template includes authentication (email/password + OAuth), database setup with Prisma, Stripe payment integration, Shadcn UI components, and Docker deployment configuration. Everything you need to start building a SaaS product.',
  },
  {
    question: 'Do I need to pay for the template?',
    answer:
      'The template itself is free and open source. You only pay for the services you choose to use (hosting, Stripe fees, etc.). We also offer premium support plans if you need dedicated help.',
  },
  {
    question: 'What database does it support?',
    answer:
      'Out of the box, the template uses SQLite with Prisma ORM. For production, you can easily switch to Turso (SQLite at the edge) or use Litestream for SQLite replication. Prisma also supports PostgreSQL, MySQL, and other databases.',
  },
  {
    question: 'How do I deploy the application?',
    answer:
      'The template includes a Dockerfile and GitHub Actions workflow for CI/CD. You can deploy to any platform that supports Docker containers - Railway, Fly.io, Render, Coolify, or your own VPS.',
  },
  {
    question: 'Can I use this for commercial projects?',
    answer:
      'Absolutely! The template is licensed under MIT, which means you can use it for any purpose, including commercial projects. No attribution required.',
  },
  {
    question: 'How do I get support?',
    answer:
      'For community support, you can open issues on GitHub or join our Discord server. For enterprise customers, we offer dedicated support with guaranteed response times.',
  },
]

export function FAQSection() {
  return (
    <section id="faq" className="py-24 lg:py-32">
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
            Frequently asked questions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Got questions? We've got answers. If you can't find what you're
            looking for, feel free to reach out.
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
