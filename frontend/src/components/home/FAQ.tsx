import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { faqs } from '../../data/faqs'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'
import { ToothMascot } from '../ui/ToothMascot'

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="scroll-mt-20 bg-(--color-surface) py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <Reveal className="mx-auto flex flex-col items-center gap-4">
          <ToothMascot type="happy" frame="standing" size="sm" className="lg:hidden" />
          <SectionHeading title="Frequently Asked Questions" />
        </Reveal>

        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center">
          <div className="flex w-full max-w-2xl flex-col divide-y divide-(--color-border) rounded-xl border border-(--color-border) bg-(--color-bg)">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index
              return (
                <div key={faq.question}>
                  <button
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-medium text-(--color-ink) sm:text-base">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 flex-none text-(--color-ink-soft) transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5">
                      <p className="text-sm leading-relaxed text-(--color-ink-soft)">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <ToothMascot
            type="happy"
            frame="standing"
            size="sm"
            className="max-lg:hidden flex-none lg:pt-6"
          />
        </div>
      </Container>
    </section>
  )
}
