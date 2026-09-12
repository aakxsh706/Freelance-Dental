import { services } from '../../data/services'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'
import { ToothMascot } from '../ui/ToothMascot'

export function Services() {
  return (
    <section id="services" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="flex flex-col gap-14">
        <Reveal className="mx-auto flex flex-col items-center gap-4">
          <ToothMascot type="superhero" frame="standing" size="sm" className="lg:hidden" />
          <SectionHeading
            eyebrow="Services"
            title="Complete Care for Every Smile"
            description="From preventive care to advanced treatments, we focus on comfortable, personalized dentistry."
          />
        </Reveal>

        {/* The superhero stands beside the card group on desktop — a `group`
            hover on the whole row gives it a very small, subtle nudge rather
            than reacting to any single card. */}
        <div className="group flex flex-col items-center gap-10 lg:flex-row lg:items-stretch">
          <div className="grid flex-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service, index) => (
              <Reveal key={service.title} delay={index * 40} as="article">
                <div className="flex h-full flex-col gap-4 rounded-xl border border-(--color-border) bg-(--color-bg) p-6 transition-colors hover:border-(--color-accent)/40">
                  <service.icon className="h-7 w-7 text-(--color-accent)" strokeWidth={1.5} />
                  <h3 className="text-base font-semibold text-(--color-ink)">{service.title}</h3>
                  <p className="text-sm leading-relaxed text-(--color-ink-soft)">
                    {service.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal
            delay={200}
            className="hidden flex-none flex-col items-center justify-end gap-3 lg:flex lg:w-44"
          >
            <ToothMascot
              type="superhero"
              frame="standing"
              size="lg"
              className="group-hover:-translate-y-1"
            />
            <p className="text-center text-xs italic text-(--color-ink-faint)">
              We&rsquo;ve got your smile covered.
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
