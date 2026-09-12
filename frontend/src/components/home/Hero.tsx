import { useSectionNav } from '../../hooks/useSectionNav'
import { Button } from '../ui/Button'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { ToothMascot } from '../ui/ToothMascot'

export function Hero() {
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
          {/* The superhero stands beside the CTAs, in normal flow rather than
              absolutely positioned, so it can never overlap a button or cause
              overflow — it simply wraps onto its own line if space is tight. */}
          <div className="flex flex-wrap items-end gap-6 pt-2">
            <div className="flex flex-wrap items-center gap-4">
              <Button to="/appointment">Book an Appointment</Button>
              <Button variant="secondary" onClick={() => goToSection('services')}>
                Explore Our Services
              </Button>
            </div>
            <ToothMascot
              type="superhero"
              frame="standing"
              size="xs"
              className="max-sm:hidden"
            />
          </div>
        </Reveal>

        <Reveal delay={120}>
          <ToothMascot
            type="happy"
            frame="card"
            animated={false}
            className="aspect-[4/5] w-full sm:aspect-[5/4] lg:aspect-[4/5]"
          />
        </Reveal>
      </Container>
    </section>
  )
}
