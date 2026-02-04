import { Link } from '@tanstack/react-router'

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ],
  resources: [
    { label: 'Documentation', href: '#' },
    { label: 'GitHub', href: '#' },
    { label: 'Discord', href: '#' },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ],
}

export function LandingFooter() {
  const scrollToSection = (href: string) => {
    if (href.startsWith('#')) {
      const id = href.slice(1)
      const element = document.getElementById(id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary shadow-md" />
              <span className="text-xl font-bold">AppStarter</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              The fastest way to build and ship your SaaS product.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <FooterLink {...link} scrollToSection={scrollToSection} />
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <FooterLink {...link} scrollToSection={scrollToSection} />
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <FooterLink {...link} scrollToSection={scrollToSection} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} AppStarter. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Built with TanStack Start
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterLink({
  label,
  href,
  scrollToSection,
}: {
  label: string
  href: string
  scrollToSection: (href: string) => void
}) {
  const className =
    'text-sm text-muted-foreground hover:text-foreground transition-colors'

  if (href.startsWith('#')) {
    return (
      <button onClick={() => scrollToSection(href)} className={className}>
        {label}
      </button>
    )
  }

  if (href.startsWith('http')) {
    return (
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    )
  }

  return (
    <Link to={href} className={className}>
      {label}
    </Link>
  )
}
