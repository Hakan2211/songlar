import { Link } from '@tanstack/react-router'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/common'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

interface LandingHeaderProps {
  isLoggedIn?: boolean
}

export function LandingHeader({ isLoggedIn = false }: LandingHeaderProps) {
  const { scrollY } = useScroll()
  const [isScrolled, setIsScrolled] = useState(false)
  const isMobile = useIsMobile()

  // Transform values based on scroll
  const headerWidth = useTransform(
    scrollY,
    [0, 100],
    isMobile ? ['100%', '100%'] : ['100%', '90%'],
  )
  const headerTop = useTransform(scrollY, [0, 100], isMobile ? [0, 0] : [0, 12])
  const headerBorderRadius = useTransform(
    scrollY,
    [0, 100],
    isMobile ? [0, 0] : [0, 16],
  )

  useEffect(() => {
    const unsubscribe = scrollY.on('change', (latest) => {
      setIsScrolled(latest > 50)
    })
    return unsubscribe
  }, [scrollY])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <motion.header
        style={{
          width: headerWidth,
          top: headerTop,
          borderRadius: headerBorderRadius,
        }}
        className={cn(
          'pointer-events-auto transition-all duration-300 ease-in-out',
          isScrolled
            ? 'bg-background/80 backdrop-blur-xl shadow-lg border border-border/50'
            : 'bg-transparent backdrop-blur-none',
        )}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <Logo size={32} />
            <span className="text-lg font-bold tracking-tight">Songlar</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {['features', 'how-it-works', 'pricing'].map((section) => (
              <button
                key={section}
                onClick={() => scrollToSection(section)}
                className={cn(
                  'text-sm font-medium transition-colors cursor-pointer relative group capitalize',
                  'text-muted-foreground hover:text-foreground',
                )}
              >
                {section.replace(/-/g, ' ')}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
              </button>
            ))}
          </nav>

          {/* Auth Buttons — context-aware */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link to="/music">
                <Button size="sm" className="group">
                  Go to Studio
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </motion.header>
    </div>
  )
}
