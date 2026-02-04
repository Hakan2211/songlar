# Animations Skill

This skill covers animation patterns using Framer Motion, tw-animate-css, and CSS transitions.

## Animation Libraries

| Library         | Purpose                                        | Usage                           |
| --------------- | ---------------------------------------------- | ------------------------------- |
| Framer Motion   | Advanced animations (scroll, gestures, layout) | `framer-motion`                 |
| tw-animate-css  | Tailwind utilities for Radix UI states         | `@import 'tw-animate-css'`      |
| CSS Transitions | Simple hover/focus effects                     | Tailwind `transition-*` classes |

## Framer Motion

### Installation

Already installed: `framer-motion: ^12.26.2`

### Basic Import

```typescript
import { motion } from 'framer-motion'
```

### Entrance Animations

```typescript
// Fade in and slide up
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  Content fades in
</motion.div>

// Fade in and scale
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.3 }}
>
  Content scales in
</motion.div>
```

### Scroll-Triggered Animations (`whileInView`)

```typescript
// Animate when element enters viewport
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}  // Only animate once
  transition={{ duration: 0.5 }}
>
  Animates when scrolled into view
</motion.div>

// With viewport margin
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true, margin: '-100px' }}  // Trigger 100px before entering
>
  Content
</motion.div>
```

### Staggered Animations

```typescript
const features = [
  { title: 'Feature 1' },
  { title: 'Feature 2' },
  { title: 'Feature 3' },
]

function FeaturesSection() {
  return (
    <div className="grid grid-cols-3 gap-6">
      {features.map((feature, index) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.5,
            delay: index * 0.1,  // Stagger by 100ms
          }}
        >
          <h3>{feature.title}</h3>
        </motion.div>
      ))}
    </div>
  )
}
```

### Scroll-Based Transforms (`useScroll` + `useTransform`)

```typescript
import { motion, useScroll, useTransform } from 'framer-motion'

function ScrollHeader() {
  const { scrollY } = useScroll()

  // Transform values based on scroll position
  const headerWidth = useTransform(scrollY, [0, 100], ['100%', '90%'])
  const headerTop = useTransform(scrollY, [0, 100], [0, 12])
  const headerBorderRadius = useTransform(scrollY, [0, 100], [0, 16])
  const headerOpacity = useTransform(scrollY, [0, 50], [0, 1])

  return (
    <motion.header
      style={{
        width: headerWidth,
        top: headerTop,
        borderRadius: headerBorderRadius,
      }}
      className="fixed left-1/2 -translate-x-1/2 z-50"
    >
      <motion.div
        style={{ opacity: headerOpacity }}
        className="absolute inset-0 bg-background/80 backdrop-blur-xl"
      />
      {/* Header content */}
    </motion.header>
  )
}
```

### Scroll State Detection

```typescript
import { useScroll } from 'framer-motion'
import { useState, useEffect } from 'react'

function Header() {
  const { scrollY } = useScroll()
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const unsubscribe = scrollY.on('change', (latest) => {
      setIsScrolled(latest > 50)
    })
    return unsubscribe
  }, [scrollY])

  return (
    <header className={cn(
      'transition-all duration-300',
      isScrolled
        ? 'bg-background/80 backdrop-blur-xl shadow-lg'
        : 'bg-transparent'
    )}>
      {/* Header content */}
    </header>
  )
}
```

### Hover Animations

```typescript
// Scale on hover
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  Click me
</motion.button>

// Complex hover state
<motion.div
  whileHover={{
    y: -4,
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
  }}
  transition={{ duration: 0.2 }}
>
  Card content
</motion.div>
```

### Exit Animations

```typescript
import { AnimatePresence, motion } from 'framer-motion'

function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background rounded-lg p-6"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

### Layout Animations

```typescript
import { motion, LayoutGroup } from 'framer-motion'

function Tabs({ activeTab, setActiveTab }) {
  const tabs = ['Home', 'About', 'Contact']

  return (
    <LayoutGroup>
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="relative px-4 py-2"
          >
            {tab}
            {activeTab === tab && (
              <motion.div
                layoutId="activeTab"  // Shared layout ID
                className="absolute inset-0 bg-primary/10 rounded-md"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </LayoutGroup>
  )
}
```

## tw-animate-css (Radix State Animations)

### Setup

Already imported in `src/styles.css`:

```css
@import 'tw-animate-css';
```

### Radix Dialog/Sheet Animations

```typescript
// Dialog overlay
<DialogOverlay
  className={cn(
    'fixed inset-0 z-50 bg-black/80',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
  )}
/>

// Dialog content
<DialogContent
  className={cn(
    'fixed left-[50%] top-[50%] z-50',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
    'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
    'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'
  )}
/>
```

### Radix Sheet (Slide) Animations

```typescript
// Sheet from right
<SheetContent
  className={cn(
    'fixed inset-y-0 right-0 z-50',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
  )}
/>

// Sheet from left
<SheetContent
  side="left"
  className={cn(
    'fixed inset-y-0 left-0 z-50',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left'
  )}
/>

// Sheet from bottom
<SheetContent
  side="bottom"
  className={cn(
    'fixed inset-x-0 bottom-0 z-50',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom'
  )}
/>
```

### Radix Accordion Animations

```typescript
// Define keyframes in CSS
@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

// Use in component
<AccordionContent
  className={cn(
    'overflow-hidden',
    'data-[state=closed]:animate-accordion-up',
    'data-[state=open]:animate-accordion-down'
  )}
/>
```

### Radix Dropdown Menu Animations

```typescript
<DropdownMenuContent
  className={cn(
    'z-50 min-w-[8rem] rounded-md border bg-popover p-1 shadow-md',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
    'data-[side=bottom]:slide-in-from-top-2',
    'data-[side=left]:slide-in-from-right-2',
    'data-[side=right]:slide-in-from-left-2',
    'data-[side=top]:slide-in-from-bottom-2'
  )}
/>
```

## CSS Transitions (Tailwind)

### Basic Transitions

```typescript
// Color transition on hover
<button className="bg-primary hover:bg-primary/90 transition-colors">
  Hover me
</button>

// All properties
<div className="transition-all duration-300 hover:shadow-lg">
  Card
</div>

// Transform
<div className="transition-transform hover:-translate-y-1">
  Lifts on hover
</div>

// Opacity
<div className="opacity-0 group-hover:opacity-100 transition-opacity">
  Appears on parent hover
</div>
```

### Duration and Timing

```typescript
// Durations
<div className="transition-all duration-150">Fast (150ms)</div>
<div className="transition-all duration-300">Normal (300ms)</div>
<div className="transition-all duration-500">Slow (500ms)</div>

// Timing functions
<div className="transition-all ease-in">Ease in</div>
<div className="transition-all ease-out">Ease out</div>
<div className="transition-all ease-in-out">Ease in-out</div>
```

### Group Hover Pattern

```typescript
// Parent triggers child animation
<div className="group">
  <span>Hover me</span>
  <ChevronRight className="ml-2 transition-transform group-hover:translate-x-1" />
</div>

// Multiple children animate
<a className="group flex items-center">
  <span className="group-hover:text-primary transition-colors">Link</span>
  <ArrowRight className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
</a>
```

### Underline Animation

```typescript
<a className="group relative">
  Link Text
  <span className="
    absolute -bottom-1 left-0
    w-0 h-0.5 bg-primary
    transition-all duration-300
    group-hover:w-full
  " />
</a>
```

### Card Hover Effect

```typescript
<div className="
  rounded-xl border bg-card p-6 shadow-sm
  transition-all duration-300
  hover:shadow-md hover:-translate-y-1
">
  Card content
</div>
```

## Performance Tips

### Use `will-change` Sparingly

```typescript
// Only for frequently animated elements
<motion.div
  style={{ willChange: 'transform' }}
  animate={{ x: position }}
/>
```

### Prefer `transform` and `opacity`

These properties are GPU-accelerated:

```typescript
// Good - uses transform
<motion.div animate={{ x: 100, y: 50, scale: 1.1 }} />

// Good - uses opacity
<motion.div animate={{ opacity: 0.5 }} />

// Avoid animating - causes layout
<motion.div animate={{ width: 200, height: 100 }} />
```

### Use `layoutId` for Smooth Transitions

```typescript
// Instead of animating position manually, use layoutId
<motion.div layoutId="shared-element">
  {/* Content moves smoothly between positions */}
</motion.div>
```

### Reduce Motion for Accessibility

```typescript
import { useReducedMotion } from 'framer-motion'

function AnimatedComponent() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
    >
      Content
    </motion.div>
  )
}
```

## SSR Considerations

### Client-Only Animations

Some animations may cause hydration mismatches. Use `ClientOnly`:

```typescript
import { ClientOnly } from '@/components/ClientOnly'

function Page() {
  return (
    <ClientOnly fallback={<StaticFallback />}>
      <AnimatedComponent />
    </ClientOnly>
  )
}
```

### Scroll-Based Components

`useScroll` and similar hooks should be used client-side only:

```typescript
function ScrollHeader() {
  const [mounted, setMounted] = useState(false)
  const { scrollY } = useScroll()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Return static version during SSR
  if (!mounted) {
    return <header className="bg-transparent">...</header>
  }

  // Use scroll-based animations after mount
  return (
    <motion.header style={{ ... }}>
      ...
    </motion.header>
  )
}
```

## Troubleshooting

### Animation Not Triggering

**Cause**: Missing `initial` or `animate` props.

**Solution**: Always provide both:

```typescript
<motion.div
  initial={{ opacity: 0 }}  // Required for animation
  animate={{ opacity: 1 }}
>
```

### `whileInView` Not Working

**Cause**: Element already in viewport on page load.

**Solution**: Add `initial` state:

```typescript
<motion.div
  initial={{ opacity: 0, y: 20 }}  // Start hidden
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
>
```

### Hydration Mismatch with Animations

**Cause**: Server renders different state than client.

**Solution**: Use consistent initial state or `ClientOnly` wrapper.

### Radix Animation Classes Not Working

**Cause**: `tw-animate-css` not imported.

**Solution**: Ensure `@import 'tw-animate-css';` is in `src/styles.css`.

### Exit Animation Not Playing

**Cause**: Missing `AnimatePresence` wrapper.

**Solution**:

```typescript
<AnimatePresence>
  {isVisible && (
    <motion.div exit={{ opacity: 0 }}>
      Content
    </motion.div>
  )}
</AnimatePresence>
```

## File References

- Global styles with tw-animate-css: `src/styles.css`
- Landing header (scroll animations): `src/components/landing/LandingHeader.tsx`
- Hero section (entrance animations): `src/components/landing/HeroSection.tsx`
- Features section (stagger animations): `src/components/landing/FeaturesSection.tsx`
- UI components with Radix animations: `src/components/ui/dialog.tsx`, `sheet.tsx`, etc.
