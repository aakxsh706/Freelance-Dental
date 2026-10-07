import { coreValues } from '../../data/values'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'
import { ToothMascot } from '../ui/ToothMascot'

export function CoreValues() {
  return (
    <section className="bg-(--color-surface) py-20 sm:py-24">
      <Container className="flex flex-col gap-14">
        <Reveal className="mx-auto flex flex-col items-center gap-4">
          <ToothMascot type="happy" frame="standing" size="sm" />
          <SectionHeading eyebrow="What Guides Us" title="Our Core Values" />
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {coreValues.map((value, index) => (
            <Reveal key={value.title} delay={index * 40} as="article">
              <div className="flex h-full flex-col items-start gap-3 rounded-xl border border-(--color-border) bg-(--color-bg) p-6">
                <value.icon className="h-6 w-6 text-(--color-accent)" strokeWidth={1.5} />
                <h3 className="text-sm font-semibold text-(--color-ink)">{value.title}</h3>
                <p className="text-sm leading-relaxed text-(--color-ink-soft)">
                  {value.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
