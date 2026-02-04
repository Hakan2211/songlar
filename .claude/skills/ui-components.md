# UI Components Skill

This skill covers UI component patterns using Shadcn UI, Tailwind CSS, and Radix UI primitives.

## Component Organization

```
src/components/
├── ui/                    # Shadcn UI primitive components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── ...
├── landing/               # Landing page sections
│   ├── index.ts           # Barrel exports
│   ├── HeroSection.tsx
│   └── ...
├── common/                # Shared utility components
│   └── Honeypot.tsx
└── ClientOnly.tsx         # SSR boundary component
```

## Adding Shadcn Components

### Installation Command

```bash
npx shadcn@latest add <component-name>
```

### Common Components

```bash
# Form components
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add textarea
npx shadcn@latest add select
npx shadcn@latest add checkbox
npx shadcn@latest add switch

# Layout components
npx shadcn@latest add card
npx shadcn@latest add separator
npx shadcn@latest add tabs

# Feedback components
npx shadcn@latest add dialog
npx shadcn@latest add sheet
npx shadcn@latest add tooltip
npx shadcn@latest add dropdown-menu

# Data display
npx shadcn@latest add table
npx shadcn@latest add badge
npx shadcn@latest add avatar
npx shadcn@latest add skeleton
```

## The `cn()` Utility

All class names should use the `cn()` utility for proper merging:

```typescript
// src/lib/utils.ts
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ClassValue } from 'clsx'

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs))
}
```

### Usage

```typescript
import { cn } from '@/lib/utils'

// Basic usage
<div className={cn('base-styles', 'more-styles')} />

// Conditional classes
<div className={cn(
  'base-styles',
  isActive && 'active-styles',
  isDisabled && 'disabled-styles'
)} />

// With props override
function MyComponent({ className }: { className?: string }) {
  return (
    <div className={cn('default-styles', className)}>
      Content
    </div>
  )
}
```

## Component Variants with CVA

Use `class-variance-authority` for components with multiple variants:

```typescript
// src/components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Base styles (always applied)
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

### Using Variants

```typescript
import { Button } from '@/components/ui/button'

// Default
<Button>Click me</Button>

// Variants
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// Combined
<Button variant="outline" size="sm">Small Outline</Button>
```

## Data Slot Attributes

All Shadcn components include `data-slot` attributes for debugging and styling:

```typescript
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-xl border bg-card p-6 shadow-sm', className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col space-y-1.5', className)}
      {...props}
    />
  )
}
```

### Styling with Data Slots

```css
/* Target specific slots */
[data-slot='card'] {
  /* Card-specific styles */
}

/* Target nested slots */
[data-slot='card'] [data-slot='card-header'] {
  /* Header within card */
}
```

## Radix UI Primitive Wrapping

Shadcn components wrap Radix UI primitives with styling:

```typescript
// src/components/ui/dialog.tsx
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal

function DialogOverlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/80',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
}

function DialogContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
          'w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export { Dialog, DialogTrigger, DialogContent }
```

## The `asChild` Pattern

Use `asChild` to render a component as a different element:

```typescript
import { Slot } from '@radix-ui/react-slot'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

function Button({ asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp {...props} />
}

// Usage: Button styled as a Link
<Button asChild>
  <Link to="/dashboard">Go to Dashboard</Link>
</Button>

// Usage: Button styled as an anchor
<Button asChild variant="link">
  <a href="https://example.com">External Link</a>
</Button>
```

## Tailwind CSS Conventions

### Semantic Color Classes

Use semantic color tokens, not raw colors:

```typescript
// Good - semantic tokens
<div className="bg-background text-foreground" />
<div className="bg-primary text-primary-foreground" />
<div className="bg-muted text-muted-foreground" />
<div className="border-border" />
<div className="bg-destructive text-destructive-foreground" />

// Avoid - raw colors
<div className="bg-white text-black" />  // Won't work with dark mode
<div className="bg-blue-500" />  // Not semantic
```

### Responsive Prefixes

```typescript
// Mobile-first responsive design
<div className="
  flex flex-col        // Mobile: vertical stack
  md:flex-row          // Tablet+: horizontal row
  lg:gap-8             // Desktop+: larger gap
" />

<div className="
  hidden               // Hidden on mobile
  md:block             // Visible on tablet+
" />

<div className="
  grid grid-cols-1     // Mobile: single column
  md:grid-cols-2       // Tablet: 2 columns
  lg:grid-cols-3       // Desktop: 3 columns
" />
```

### State-Based Styling

```typescript
// Focus states
<input className="focus-visible:ring-2 focus-visible:ring-ring" />

// Hover states
<button className="hover:bg-accent hover:text-accent-foreground" />

// Disabled states
<button className="disabled:pointer-events-none disabled:opacity-50" />

// Dark mode (if using class-based dark mode)
<div className="bg-background dark:bg-slate-900" />

// Group hover
<div className="group">
  <span className="group-hover:text-primary">Hover parent to see</span>
</div>

// Aria states
<input className="aria-invalid:border-destructive" />

// Data states (Radix)
<div className="data-[state=open]:bg-accent" />
```

## Creating New Components

### Basic Component Template

```typescript
// src/components/ui/my-component.tsx
import { cn } from '@/lib/utils'

interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  // Add custom props
}

function MyComponent({ className, ...props }: MyComponentProps) {
  return (
    <div
      data-slot="my-component"
      className={cn(
        'base-styles-here',
        className
      )}
      {...props}
    />
  )
}

export { MyComponent }
```

### Component with Variants

```typescript
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-lg border p-4',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive: 'border-destructive/50 text-destructive bg-destructive/10',
        success: 'border-green-500/50 text-green-600 bg-green-500/10',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Alert, alertVariants }
```

## Barrel Exports

Group related components with barrel exports:

```typescript
// src/components/landing/index.ts
export { LandingHeader } from './LandingHeader'
export { HeroSection } from './HeroSection'
export { FeaturesSection } from './FeaturesSection'
export { PricingSection } from './PricingSection'
export { CTASection } from './CTASection'
export { LandingFooter } from './LandingFooter'
```

### Usage

```typescript
// Import multiple components from one path
import {
  LandingHeader,
  HeroSection,
  FeaturesSection,
  PricingSection,
} from '@/components/landing'
```

## ClientOnly Wrapper

For components that should only render on the client (e.g., browser APIs):

```typescript
// src/components/ClientOnly.tsx
import { useState, useEffect, type ReactNode } from 'react'

interface ClientOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return fallback

  return <>{children}</>
}
```

### Usage

```typescript
import { ClientOnly } from '@/components/ClientOnly'
import { Skeleton } from '@/components/ui/skeleton'

function MyPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-[200px]" />}>
      <BrowserOnlyChart />
    </ClientOnly>
  )
}
```

## Troubleshooting

### Styles Not Applying

**Cause**: Class names not being merged correctly or Tailwind not scanning the file.

**Solution**:

1. Use `cn()` for all class name merging
2. Check `content` array in Tailwind config includes your file

### Component Not Found After Adding

**Cause**: Shadcn adds components to `src/components/ui/` but import path might be wrong.

**Solution**:

```typescript
// Use the correct import path
import { Button } from '@/components/ui/button'
```

### Dark Mode Not Working

**Cause**: Theme CSS variables not defined for dark mode.

**Solution**: Check `src/styles.css` has both `:root` and `.dark` selectors with color variables.

### Radix Animation Not Triggering

**Cause**: `tw-animate-css` not imported or animation classes missing.

**Solution**:

1. Ensure `@import 'tw-animate-css';` is in `src/styles.css`
2. Use Radix data attributes: `data-[state=open]:animate-in`

### "Cannot find module" for UI Component

**Cause**: Component not installed yet.

**Solution**:

```bash
npx shadcn@latest add <component-name>
```

## File References

- UI components: `src/components/ui/`
- Landing components: `src/components/landing/`
- Common components: `src/components/common/`
- Utils (cn): `src/lib/utils.ts`
- Global styles: `src/styles.css`
- Tailwind config: `tailwind.config.ts` (if exists)
