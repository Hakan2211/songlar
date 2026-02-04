import { createFileRoute } from '@tanstack/react-router'
import {
  LandingHeader,
  HeroSection,
  FeaturesSection,
  HowItWorksSection,
  PricingSection,
  FAQSection,
  CTASection,
  LandingFooter,
} from '@/components/landing'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  )
}
