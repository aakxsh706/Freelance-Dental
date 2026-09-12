import { useEffect, useRef, useState } from 'react'

/** Lightweight, dependency-free "fade up on scroll into view" primitive
 * backing the <Reveal> wrapper. Uses IntersectionObserver rather than a
 * scroll listener so it stays cheap on long pages. */
export function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, isVisible }
}
