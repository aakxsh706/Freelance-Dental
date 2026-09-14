import { X } from 'lucide-react'
import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Service } from '../../data/services'

interface ServiceDetailModalProps {
  service: Service
  onClose: () => void
  /** Focus is restored here when the modal closes. */
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

/** Lightweight detail panel for a service card — same portal/inert/Escape
 * pattern as <SmileTour>, without the spotlight/scroll machinery a tour
 * step needs. */
export function ServiceDetailModal({ service, onClose, returnFocusRef }: ServiceDetailModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.getElementById('root')
    const trigger = returnFocusRef.current
    root?.setAttribute('inert', '')
    panelRef.current?.focus()
    return () => {
      root?.removeAttribute('inert')
      trigger?.focus()
    }
  }, [returnFocusRef])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="tour-fade-in absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-detail-title"
        tabIndex={-1}
        className="service-modal-in relative flex w-full max-w-md flex-col gap-5 rounded-2xl border border-(--color-border) bg-(--color-bg) p-6 shadow-xl outline-none"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-(--color-accent-soft)">
            <service.icon className="h-6 w-6 text-(--color-accent)" strokeWidth={1.5} />
          </span>
          <h2
            id="service-detail-title"
            className="flex-1 pt-1.5 text-lg font-semibold text-(--color-ink)"
          >
            {service.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close service details"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-(--color-ink-faint) transition-colors hover:bg-(--color-surface) hover:text-(--color-ink) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-(--color-ink-soft)">{service.description}</p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-(--color-accent) px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-(--color-accent-hover)"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
