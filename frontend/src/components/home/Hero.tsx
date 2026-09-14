import { Sparkles } from 'lucide-react'
import type { RefObject } from 'react'
import belinDentalLogo from '../../assets/BelinDental_Logo.jpeg'
import { useSectionNav } from '../../hooks/useSectionNav'
import { Button } from '../ui/Button'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'

interface HeroProps {
  onStartTour: () => void
  tourButtonRef: RefObject<HTMLButtonElement | null>
}

export function Hero({ onStartTour, tourButtonRef }: HeroProps) {
  const { goToSection } = useSectionNav()

  return (
    <section className="relative overflow-hidden bg-(--color-bg) pt-14 pb-20 sm:pt-20 sm:pb-28">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal className="flex flex-col gap-7">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent)">
            Belin&rsquo;s Dental Clinic
          </span>
          <h1 className="text-4xl font-semibold leading-[1.1] text-(--color-ink) sm:text-5xl lg:text-6xl">
            A healthier smile begins with the right care.
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-(--color-ink-soft)">
            Personalized dental care designed around your comfort, confidence, and long-term
            oral health.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button to="/appointment">Book an Appointment</Button>
            <Button variant="secondary" onClick={() => goToSection('services')}>
              Explore Our Services
            </Button>
          </div>

          {/* Entry point to the guided walkthrough — deliberately understated
              so it never competes with the two primary CTAs above it. */}
          <button
            ref={tourButtonRef}
            onClick={onStartTour}
            className="group inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-(--color-accent) transition-colors duration-200 hover:bg-(--color-accent-soft)"
          >
            <Sparkles
              className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12"
              strokeWidth={1.75}
            />
            Take a Quick Tour
          </button>
        </Reveal>

        <Reveal delay={120}>
          {/* Official clinic branding — deliberately not routed through
              <ToothMascot>, which is reserved for the character
              illustrations elsewhere on the site. The container's
              background is sampled from the logo artwork itself so its own
              flat backdrop blends in seamlessly instead of showing a
              mismatched white seam. */}
          <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl border border-(--color-border) bg-[#dddad5] sm:aspect-[5/4] lg:aspect-[4/5]">
            <div className="flex h-full w-full items-center justify-center p-10 sm:p-14">
              <img
                src={belinDentalLogo}
                alt="Belin's Dental Clinic logo"
                draggable={false}
                className="h-full w-full select-none object-contain"
              />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
