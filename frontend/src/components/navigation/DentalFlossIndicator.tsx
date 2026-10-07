import { useEffect, useRef } from 'react'
import { FLOSS_NODES, HAPPY_TOOTH_END, SUPERHERO_TOOTH_START } from '../../data/flossIndicator'
import { mascots } from '../../data/mascots'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface DentalFlossIndicatorProps {
  /** Temporarily hide (e.g. while the guided tour is open) without tearing
   * down the scroll listener — cheaper than unmounting/remounting. */
  hidden?: boolean
}

const IDLE_DEBOUNCE_MS = 180

function happyOpacityFor(progress: number): number {
  if (progress <= HAPPY_TOOTH_END) return 1
  if (progress >= SUPERHERO_TOOTH_START) return 0
  return 1 - (progress - HAPPY_TOOTH_END) / (SUPERHERO_TOOTH_START - HAPPY_TOOTH_END)
}

/**
 * A subtle fixed "dental floss" scroll-progress novelty for the homepage.
 * Pure DOM/CSS updates driven from a single rAF-throttled scroll listener —
 * no React state churn per scroll frame, no getBoundingClientRect in the
 * hot path (dimensions are cached and only re-measured on resize).
 */
export function DentalFlossIndicator({ hidden = false }: DentalFlossIndicatorProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const mascotOuterRef = useRef<HTMLDivElement>(null)
  const idleLayerRef = useRef<HTMLDivElement>(null)
  const happyRef = useRef<HTMLImageElement>(null)
  const superheroRef = useRef<HTMLImageElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const track = trackRef.current
    const mascotOuter = mascotOuterRef.current
    if (!track || !mascotOuter) return

    let scrollableHeight = 1
    let travelRange = 1
    let rafId: number | null = null
    let idleTimer: number | null = null

    function measure() {
      scrollableHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const mascotHeight = mascotOuter!.offsetHeight
      travelRange = Math.max(0, track!.clientHeight - mascotHeight)
    }

    function applyProgress(progress: number) {
      const y = progress * travelRange
      mascotOuter!.style.transform = `translateY(${y}px)`
      lineRef.current?.style.setProperty('--floss-progress', `${progress * 100}%`)

      const happyOpacity = happyOpacityFor(progress)
      if (happyRef.current) happyRef.current.style.opacity = String(happyOpacity)
      if (superheroRef.current) superheroRef.current.style.opacity = String(1 - happyOpacity)
    }

    function markScrolling() {
      idleLayerRef.current?.classList.remove('floss-mascot-idle')
      if (idleTimer !== null) window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        idleLayerRef.current?.classList.add('floss-mascot-idle')
      }, IDLE_DEBOUNCE_MS)
    }

    function onScroll() {
      markScrolling()
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const progress = Math.min(1, Math.max(0, window.scrollY / scrollableHeight))
        applyProgress(progress)
      })
    }

    function remeasureAndReapply() {
      measure()
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollableHeight))
      applyProgress(progress)
    }

    remeasureAndReapply()
    // Settle into idle after mount too, not just after the first scroll.
    idleTimer = window.setTimeout(() => {
      idleLayerRef.current?.classList.add('floss-mascot-idle')
    }, IDLE_DEBOUNCE_MS)

    // Window resize covers viewport changes; ResizeObserver on the document
    // covers content-driven height changes (web fonts swapping in, lazy
    // images settling, etc.) that happen without ever firing a resize event
    // — without it, a scroll-progress cached too early reads as permanently
    // "behind" for the rest of the page's life.
    const resizeObserver = new ResizeObserver(() => remeasureAndReapply())
    resizeObserver.observe(document.documentElement)

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', remeasureAndReapply)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', remeasureAndReapply)
      resizeObserver.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (idleTimer !== null) window.clearTimeout(idleTimer)
    }
  }, [])

  const positionTransitionMs = reducedMotion ? 0 : 140
  const fadeTransitionMs = reducedMotion ? 80 : 220

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-[15%] right-2 bottom-[15%] z-30 sm:right-5 lg:right-7"
      style={{
        opacity: hidden ? 0 : 1,
        transition: 'opacity 300ms ease',
      }}
    >
      <div ref={trackRef} className="relative mx-auto h-full w-px">
        <div ref={lineRef} className="floss-line absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />

        {FLOSS_NODES.map((position, index) => (
          <span
            key={index}
            className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--color-border)"
            style={{ top: `${position * 100}%` }}
          />
        ))}

        <div
          ref={mascotOuterRef}
          className="absolute top-0 left-1/2 -translate-x-1/2"
          style={{ transition: `transform ${positionTransitionMs}ms linear` }}
        >
          <div
            ref={idleLayerRef}
            className="relative h-7 w-7 sm:h-9 sm:w-9 lg:h-11 lg:w-11"
          >
            <img
              ref={happyRef}
              src={mascots.happy.cutout}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain drop-shadow-sm"
              style={{ transition: `opacity ${fadeTransitionMs}ms ease` }}
            />
            <img
              ref={superheroRef}
              src={mascots.superhero.cutout}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain drop-shadow-sm"
              style={{ opacity: 0, transition: `opacity ${fadeTransitionMs}ms ease` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
