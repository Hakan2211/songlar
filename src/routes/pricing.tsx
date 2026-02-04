import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})

function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <span className="text-xl font-bold">AppStarter</span>
          </Link>
          <nav className="flex items-center space-x-4">
            <Link to="/pricing" className="text-sm font-medium text-foreground">
              Pricing
            </Link>
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24">
          <div className="mb-16 text-center">
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="text-lg text-muted-foreground">
              Start free, upgrade when you're ready
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Free Plan */}
            <div className="flex flex-col rounded-lg border bg-card p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold">Free</h3>
                <div className="mt-2 flex items-baseline">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="ml-1 text-muted-foreground">/month</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Perfect for getting started
                </p>
              </div>
              <ul className="mb-8 flex-1 space-y-3 text-sm">
                <PricingFeature>Up to 3 projects</PricingFeature>
                <PricingFeature>Basic analytics</PricingFeature>
                <PricingFeature>Community support</PricingFeature>
              </ul>
              <Link to="/signup">
                <Button variant="outline" className="w-full">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="relative flex flex-col rounded-lg border-2 border-primary bg-card p-8 shadow-md">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Most Popular
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold">Pro</h3>
                <div className="mt-2 flex items-baseline">
                  <span className="text-4xl font-bold">$19</span>
                  <span className="ml-1 text-muted-foreground">/month</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  For growing teams
                </p>
              </div>
              <ul className="mb-8 flex-1 space-y-3 text-sm">
                <PricingFeature>Unlimited projects</PricingFeature>
                <PricingFeature>Advanced analytics</PricingFeature>
                <PricingFeature>Priority support</PricingFeature>
                <PricingFeature>Custom integrations</PricingFeature>
                <PricingFeature>Team collaboration</PricingFeature>
              </ul>
              <Link to="/signup">
                <Button className="w-full">Start Free Trial</Button>
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="flex flex-col rounded-lg border bg-card p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold">Enterprise</h3>
                <div className="mt-2 flex items-baseline">
                  <span className="text-4xl font-bold">Custom</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  For large organizations
                </p>
              </div>
              <ul className="mb-8 flex-1 space-y-3 text-sm">
                <PricingFeature>Everything in Pro</PricingFeature>
                <PricingFeature>SLA guarantee</PricingFeature>
                <PricingFeature>Dedicated support</PricingFeature>
                <PricingFeature>Custom contracts</PricingFeature>
                <PricingFeature>On-premise option</PricingFeature>
              </ul>
              <Button variant="outline" className="w-full">
                Contact Sales
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} AppStarter. Built with TanStack Start.
          </p>
          <nav className="flex items-center space-x-4">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Home
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

function PricingFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center">
      <svg
        className="mr-2 h-4 w-4 text-primary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      {children}
    </li>
  )
}
