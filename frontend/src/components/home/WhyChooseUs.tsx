import { Check } from 'lucide-react'
import { benefits } from '../../data/benefits'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'
import { ToothMascot } from '../ui/ToothMascot'

export function WhyChooseUs() {
  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col gap-14">
        <Reveal className="mx-auto flex flex-col items-center gap-3">
          <ToothMascot type="superhero" frame="standing" size="sm" className="lg:hidden" />
          <SectionHeading title="Why Patients Choose Belin's Dental Clinic" />
          <p className="text-sm italic text-(--color-ink-faint)">
            Your smile deserves a little superhero care.
          </p>
        </Reveal>

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
          <div className="grid flex-1 gap-x-10 gap-y-5 sm:grid-cols-2">
            {benefits.map((benefit, index) => (
              <Reveal key={benefit} delay={index * 30} as="div">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-(--color-accent-soft)">
                    <Check className="h-3.5 w-3.5 text-(--color-accent)" strokeWidth={2} />
                  </span>
                  <p className="text-base text-(--color-ink)">{benefit}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* The superhero "protects" the list of advantages, standing at
              its edge rather than inside any single item. */}
          <Reveal delay={220} className="hidden flex-none justify-center lg:flex lg:w-56 lg:pt-2">
            <ToothMascot type="superhero" frame="standing" size="lg" />
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
