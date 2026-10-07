import { Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { bookingMascotConfig, type BookingMascotState } from '../../data/bookingMascot'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { ToothMascot } from '../ui/ToothMascot'

interface HappyToothCompanionProps {
  state: BookingMascotState
  className?: string
}

interface Sparkle {
  top: string
  left: string
  delay: string
  end: string
}

const SUCCESS_SPARKLES: Sparkle[] = [
  { top: '-8%', left: '2%', delay: '0ms', end: 'translate(-12px, -18px) scale(1)' },
  { top: '-4%', left: '82%', delay: '110ms', end: 'translate(14px, -14px) scale(1)' },
  { top: '68%', left: '90%', delay: '220ms', end: 'translate(16px, 12px) scale(1)' },
  { top: '74%', left: '-4%', delay: '70ms', end: 'translate(-14px, 12px) scale(1)' },
]

// How much of the raw distance-to-target the mascot actually travels, and
// the hard cap on that travel — a "lean toward", never a literal jump onto
// the target (which would risk covering it or breaking out of its own
// column on narrow layouts).
const LEAN_RATIO_X = 0.05
const LEAN_RATIO_Y = 0.07
const MAX_LEAN_X = 18
const MAX_LEAN_Y = 20

function clamp(value: number, max: number): number {
  return Math.max(-max, Math.min(max, value))
}

/** Bounded offset from the companion's resting spot toward the given
 * booking-step element, computed from real DOM rects rather than
 * hardcoded coordinates so it keeps working across breakpoints/content
 * changes. Recomputed on mount/state change/resize only — never on scroll
 * or per-frame, since the companion and its targets scroll together. */
function useLeanTowardTarget(targetSelector: string | undefined, disabled: boolean) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [lean, setLean] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (disabled || !targetSelector) {
      // oxlint-disable-next-line set-state-in-effect
      setLean({ x: 0, y: 0 })
      return
    }

    function recompute() {
      const anchor = anchorRef.current
      const target = targetSelector ? document.querySelector(targetSelector) : null
      if (!anchor || !target) {
        setLean({ x: 0, y: 0 })
        return
      }
      const anchorRect = anchor.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const dx = targetRect.left + targetRect.width / 2 - (anchorRect.left + anchorRect.width / 2)
      const dy = targetRect.top + targetRect.height / 2 - (anchorRect.top + anchorRect.height / 2)
      setLean({
        x: clamp(dx * LEAN_RATIO_X, MAX_LEAN_X),
        y: clamp(dy * LEAN_RATIO_Y, MAX_LEAN_Y),
      })
    }

    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [targetSelector, disabled])

  return { anchorRef, lean }
}

/** The Happy Tooth booking companion — a single reusable presentational
 * component driven entirely by `state`. Every reaction is position/scale/
 * opacity/message text; the supplied mascot artwork itself is never altered. */
export function HappyToothCompanion({ state, className = '' }: HappyToothCompanionProps) {
  const reducedMotion = useReducedMotion()
  const config = bookingMascotConfig[state]
  const isIdle = config.scale === 1
  const { anchorRef, lean } = useLeanTowardTarget(config.targetSelector, reducedMotion)

  // Inline (not a class) so it deterministically wins over ToothMascot's own
  // baked-in `transition-transform duration-300` utility classes — mixing
  // two class-based transition rules on the same element leaves the winner
  // up to stylesheet source order, which isn't worth relying on here.
  const mascotStyle: CSSProperties = {
    transform: `translate(${lean.x}px, ${lean.y}px) scale(${config.scale})`,
    transition: reducedMotion
      ? 'transform 150ms ease-out'
      : 'transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  }

  return (
    <div ref={anchorRef} className={`flex flex-col items-center gap-6 text-center ${className}`}>
      <div className="relative flex h-32 w-32 items-center justify-center sm:h-36 sm:w-36">
        {state === 'success' &&
          !reducedMotion &&
          SUCCESS_SPARKLES.map((sparkle, index) => (
            <Sparkles
              key={index}
              aria-hidden
              strokeWidth={1.5}
              className="mascot-sparkle absolute h-4 w-4 text-(--color-accent)"
              style={
                {
                  top: sparkle.top,
                  left: sparkle.left,
                  animationDelay: sparkle.delay,
                  '--sparkle-end': sparkle.end,
                } as CSSProperties
              }
            />
          ))}
        <ToothMascot
          type="happy"
          frame="standing"
          size="sm"
          animated={isIdle && !reducedMotion}
          style={mascotStyle}
        />
      </div>

      {/* Message stays anchored (no lean) so it's always readable and never
          contributes to layout shift — only the mascot itself travels. */}
      <div key={state} className={reducedMotion ? undefined : 'message-fade-in'}>
        <p className="text-base font-semibold text-(--color-ink)" role="status">
          {config.message}
        </p>
        {config.supportingText && (
          <p className="mt-1 text-sm text-(--color-ink-soft)">{config.supportingText}</p>
        )}
      </div>
    </div>
  )
}
