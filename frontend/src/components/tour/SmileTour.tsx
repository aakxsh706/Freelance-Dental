import type { CSSProperties, RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tourSteps } from '../../data/tour'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { ToothMascot } from '../ui/ToothMascot'

interface SmileTourProps {
  onClose: () => void
  /** Focus is restored here when the tour closes. */
  triggerRef: RefObject<HTMLButtonElement | null>
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

const SCROLL_SETTLE_MS = 550
const PANEL_HEIGHT_ESTIMATE = 260
const SPOTLIGHT_PADDING = 10

function measureTarget(selector: string): TargetRect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

function computePanelPosition(rect: TargetRect | null): CSSProperties {
  if (!rect) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
  const viewportHeight = window.innerHeight
  const spaceBelow = viewportHeight - (rect.top + rect.height)
  const placeBelow = spaceBelow > PANEL_HEIGHT_ESTIMATE + 24
  let top = placeBelow
    ? rect.top + rect.height + 20
    : rect.top - PANEL_HEIGHT_ESTIMATE - 20
  top = Math.max(16, Math.min(viewportHeight - PANEL_HEIGHT_ESTIMATE - 16, top))
  return { top, left: '50%', transform: 'translateX(-50%)' }
}

/** Mounted by the parent only while the tour is open (`{isTourOpen && <SmileTour .../>}`),
 * so step state naturally starts fresh on every mount — no reset effect needed. */
export function SmileTour({ onClose, triggerRef }: SmileTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const reducedMotion = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  const step = tourSteps[stepIndex]

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Scroll the target into view and measure it whenever the step changes.
  // This is DOM measurement synchronized from step state — an external
  // system a render can't compute, so the setState-in-effect is intentional.
  useEffect(() => {
    let cancelled = false

    if (!step.target) {
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
      // oxlint-disable-next-line set-state-in-effect
      setTargetRect(null)
      return
    }

    const el = document.querySelector(step.target)
    el?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
    const delay = reducedMotion ? 0 : SCROLL_SETTLE_MS
    const timer = setTimeout(() => {
      if (!cancelled) setTargetRect(measureTarget(step.target!))
    }, delay)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [stepIndex, step.target, reducedMotion])

  // Keep the spotlight synced if the user scrolls/resizes mid-step.
  useEffect(() => {
    if (!step.target) return
    function onScrollOrResize() {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        setTargetRect(measureTarget(step.target!))
      })
    }
    window.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('resize', onScrollOrResize)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [step.target])

  // Isolate the rest of the app from interaction/focus/AT while open, and
  // manage focus in and back out again — inert removes the underlying page
  // from the tab order and pointer interaction in one step, so no manual
  // focus-trap keydown handling is needed.
  useEffect(() => {
    const root = document.getElementById('root')
    const trigger = triggerRef.current
    root?.setAttribute('inert', '')
    panelRef.current?.focus()
    return () => {
      root?.removeAttribute('inert')
      trigger?.focus()
    }
  }, [triggerRef])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleClose])

  const isFirst = stepIndex === 0
  const isLast = stepIndex === tourSteps.length - 1
  const transitionClass = reducedMotion ? '' : 'transition-all duration-500 ease-in-out'

  function handleNext() {
    if (isLast) {
      handleClose()
      return
    }
    setStepIndex((i) => Math.min(tourSteps.length - 1, i + 1))
  }

  function handleBack() {
    setStepIndex((i) => Math.max(0, i - 1))
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div
        className={`tour-fade-in absolute inset-0 bg-black/55 ${transitionClass}`}
        onClick={handleClose}
      />

      {targetRect && (
        <div
          aria-hidden
          className={`pointer-events-none absolute rounded-2xl ring-2 ring-(--color-accent) ${transitionClass}`}
          style={{
            top: targetRect.top - SPOTLIGHT_PADDING,
            left: targetRect.left - SPOTLIGHT_PADDING,
            width: targetRect.width + SPOTLIGHT_PADDING * 2,
            height: targetRect.height + SPOTLIGHT_PADDING * 2,
            boxShadow: '0 0 0 9999px rgba(20, 22, 20, 0.6)',
          }}
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="smile-tour-title"
        tabIndex={-1}
        className={`tour-fade-in absolute flex w-[calc(100%-2rem)] max-w-md flex-col gap-4 rounded-2xl border border-(--color-border) bg-(--color-bg) p-6 shadow-xl outline-none sm:max-w-lg ${transitionClass}`}
        style={computePanelPosition(targetRect)}
      >
        <div className="flex items-start gap-4">
          <ToothMascot type="superhero" frame="standing" size="sm" animated={!reducedMotion} />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <p className="text-xs font-medium tracking-wide text-(--color-ink-faint) uppercase">
              Step {stepIndex + 1} of {tourSteps.length}
            </p>
            <h2 id="smile-tour-title" className="text-lg font-semibold text-(--color-ink)">
              {step.title}
            </h2>
            <p className="text-sm leading-relaxed text-(--color-ink-soft)">{step.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={handleClose}
            className="rounded-full px-2 py-1 text-xs font-medium text-(--color-ink-faint) hover:text-(--color-ink)"
          >
            Skip Tour
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={handleBack}
                className="rounded-full border border-(--color-border) px-4 py-2 text-sm font-medium text-(--color-ink) transition-colors hover:border-(--color-accent)/40"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="rounded-full bg-(--color-accent) px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-(--color-accent-hover)"
            >
              {step.ctaLabel}
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-1.5" aria-hidden>
          {tourSteps.map((s, index) => (
            <span
              key={s.id}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                index === stepIndex ? 'bg-(--color-accent)' : 'bg-(--color-border)'
              }`}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
