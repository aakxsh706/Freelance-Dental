import { useRef, useState } from 'react'
import { services } from '../../data/services'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'
import { ToothMascot } from '../ui/ToothMascot'
import { ServiceDetailModal } from './ServiceDetailModal'

// The desktop grid (where the mascot stands beside the cards) is always
// 4 columns — the mobile/tablet layouts collapse to 1-2 columns, but the
// mascot there is a separate, non-interactive standing figure above the
// heading (no hover on touch devices), so this geometry only needs to
// describe the lg+ layout.
const GRID_COLUMNS = 4

/** Row/column-aware nudge instead of a hardcoded per-card coordinate table —
 * keeps working if services are added/removed/reworded. The mascot stands to
 * the right of the grid, so a card further left or in the top row needs a
 * larger reach; a card in the bottom-right (nearest the mascot) barely moves. */
function getAttentionTransform(index: number): string {
  const col = index % GRID_COLUMNS
  const row = Math.floor(index / GRID_COLUMNS)
  const x = -(8 + (GRID_COLUMNS - 1 - col) * 9) // -8px (nearest column) to -35px (farthest)
  const y = row === 0 ? -32 : -10 // top row needs a bigger reach than the bottom row
  return `translate(${x}px, ${y}px) rotate(-2deg) scale(1.04)`
}

export function Services() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const reducedMotion = useReducedMotion()
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null)

  const attentionTransform =
    activeIndex !== null && !reducedMotion ? getAttentionTransform(activeIndex) : undefined

  function openService(index: number) {
    selectedTriggerRef.current = cardRefs.current[index]
    setSelectedIndex(index)
  }

  return (
    <section id="services" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="flex flex-col gap-14">
        <div data-tour="services-intro">
          <Reveal className="mx-auto flex flex-col items-center gap-4">
            <ToothMascot type="superhero" frame="standing" size="sm" className="lg:hidden" />
            <SectionHeading
              eyebrow="Services"
              title="Complete Care for Every Smile"
              description="From preventive care to advanced treatments, we focus on comfortable, personalized dentistry."
            />
          </Reveal>
        </div>

        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-stretch">
          <div
            data-tour="service-cards"
            className="grid flex-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
            onMouseLeave={() => setActiveIndex(null)}
          >
            {services.map((service, index) => {
              const isActive = activeIndex === index
              return (
                <Reveal key={service.title} delay={index * 40} as="article">
                  <button
                    type="button"
                    ref={(el) => {
                      cardRefs.current[index] = el
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onBlur={() => setActiveIndex(null)}
                    onClick={() => openService(index)}
                    className={`group flex h-full w-full flex-col items-center gap-3 rounded-xl border bg-(--color-bg) px-5 py-7 text-center transition-[transform,border-color,box-shadow] duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/50 focus-visible:ring-offset-2 ${
                      isActive
                        ? `border-(--color-accent)/50 shadow-md ${reducedMotion ? '' : '-translate-y-1'}`
                        : 'border-(--color-border)'
                    }`}
                  >
                    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-(--color-accent-soft) transition-transform duration-300 group-hover:scale-110">
                      <service.icon className="h-6 w-6 text-(--color-accent)" strokeWidth={1.5} />
                    </span>
                    <h3 className="flex min-h-[2.5rem] items-center text-sm leading-snug font-semibold text-(--color-ink)">
                      {service.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-(--color-accent) opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                      Learn more
                      <span
                        aria-hidden
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                      >
                        →
                      </span>
                    </span>
                  </button>
                </Reveal>
              )
            })}
          </div>

          {/* One superhero, standing beside the grid — it leans toward
              whichever card is active rather than duplicating itself per card. */}
          <Reveal
            delay={200}
            className="hidden flex-none flex-col items-center justify-end gap-3 lg:flex lg:w-44"
          >
            <ToothMascot
              type="superhero"
              frame="standing"
              size="lg"
              animated={activeIndex === null}
              style={attentionTransform ? { transform: attentionTransform } : undefined}
            />
            <p className="text-center text-xs italic text-(--color-ink-faint)">
              We&rsquo;ve got your smile covered.
            </p>
          </Reveal>
        </div>
      </Container>

      {selectedIndex !== null && (
        <ServiceDetailModal
          service={services[selectedIndex]}
          onClose={() => setSelectedIndex(null)}
          returnFocusRef={selectedTriggerRef}
        />
      )}
    </section>
  )
}
