import {  useEffect, useState } from 'react'
import type {ReactNode} from 'react';

/**
 * ClientOnly wrapper component
 * Only renders children after the component has mounted on the client.
 * Prevents server-side rendering of client-only components like:
 * - Three.js/WebGL canvases
 * - Components using browser-only APIs (localStorage, window)
 * - Components that break SSR
 *
 * @example
 * ```tsx
 * <ClientOnly fallback={<div>Loading...</div>}>
 *   <ThreeJSCanvas />
 * </ClientOnly>
 * ```
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return fallback
  return <>{children}</>
}
