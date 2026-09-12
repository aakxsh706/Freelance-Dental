import { offers } from '../../data/offers'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'
import { ToothMascot } from '../ui/ToothMascot'

export function Offers() {
  return (
    <section className="bg-(--color-surface) py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <Reveal className="mx-auto flex flex-col items-center gap-4">
          <ToothMascot type="superhero" frame="standing" size="sm" className="lg:hidden" />
          <SectionHeading eyebrow="Sample Offers" title="Special Offers" />
        </Reveal>

        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-6 sm:grid-cols-3">
            {offers.map((offer, index) => (
              <Reveal key={offer.title} delay={index * 60} as="article">
                <div className="flex h-full flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-bg) p-7">
                  <h3 className="text-lg font-semibold text-(--color-ink)">{offer.title}</h3>
                  <p className="text-sm leading-relaxed text-(--color-ink-soft)">
                    {offer.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* The superhero stands at the end of the offer row, as though
              presenting/watching over them — a separate character, not part
              of any single card. */}
          <Reveal delay={200} className="hidden flex-none lg:block">
            <ToothMascot type="superhero" frame="standing" size="md" />
          </Reveal>
        </div>

        <p className="mx-auto text-center text-xs text-(--color-ink-faint)">
          These are sample offers for illustration only — replace with the clinic&rsquo;s actual,
          current promotions.
        </p>
      </Container>
    </section>
  )
}
