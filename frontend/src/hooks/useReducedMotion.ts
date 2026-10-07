import { useEffect, useState } from 'react'

/** Tracks prefers-reduced-motion so JS-driven transforms (not just CSS
 * animations) can be skipped — e.g. the Services mascot's hover-triggered
 * position shift, which is a `style` override rather than a keyframe
 * animation and so isn't covered by the CSS media query alone. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => setReduced(query.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return reduced
}
