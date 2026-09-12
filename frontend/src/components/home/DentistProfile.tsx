import { UserRound } from 'lucide-react'
import { getDentistProfile } from '../../api/dentist'
import { fallbackDentist } from '../../data/clinicConfig'
import { useFetch } from '../../hooks/useFetch'
import { Container } from '../ui/Container'
import { ImagePlaceholder } from '../ui/ImagePlaceholder'
import { Reveal } from '../ui/Reveal'

export function DentistProfile() {
  const { data, loading } = useFetch(getDentistProfile, [])
  const dentist = data ?? fallbackDentist

  return (
    <section id="about" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <ImagePlaceholder
            label="Dentist Photo — Placeholder"
            icon={UserRound}
            className="aspect-[4/5] w-full"
          />
        </Reveal>

        <Reveal delay={100} className="flex flex-col gap-5">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent)">
            Meet Your Dentist
          </span>
          {loading ? (
            <div className="flex flex-col gap-3">
              <div className="h-8 w-48 animate-pulse rounded bg-(--color-surface)" />
              <div className="h-4 w-64 animate-pulse rounded bg-(--color-surface)" />
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-semibold text-(--color-ink) sm:text-4xl">
                {dentist.name}
              </h2>
              <p className="text-sm font-medium text-(--color-ink-soft)">{dentist.title}</p>
            </>
          )}
          <p className="text-base leading-relaxed text-(--color-ink-soft)">{dentist.bio}</p>
        </Reveal>
      </Container>
    </section>
  )
}
