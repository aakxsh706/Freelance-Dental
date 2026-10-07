import { Phone } from 'lucide-react'
import { getClinicSettings } from '../../api/clinic'
import { fallbackClinicSettings } from '../../data/clinicConfig'
import { useFetch } from '../../hooks/useFetch'
import { telHref } from '../../lib/format'
import { Button } from '../ui/Button'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { ToothMascot } from '../ui/ToothMascot'

export function AppointmentCTA() {
  const { data: settings } = useFetch(getClinicSettings, [])
  const clinic = settings ?? fallbackClinicSettings

  return (
    <section id="appointment" className="scroll-mt-20 py-20 sm:py-24">
      <Container>
        <Reveal>
          <div className="flex flex-col gap-10 rounded-2xl border border-(--color-border) bg-(--color-accent-soft) px-8 py-14 sm:px-12 lg:px-16">
            {/* Happy Tooth stands beside the CTA — a group-hover on the whole
                card gives it a very small, encouraging nudge toward the button. */}
            <div className="group flex flex-col items-center gap-8 text-center lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:text-left">
              <div className="flex flex-col items-center gap-5 lg:items-start">
                <h2 className="max-w-xl text-3xl font-semibold text-(--color-ink) sm:text-4xl">
                  Ready for your next visit?
                </h2>
                <p className="max-w-md text-base leading-relaxed text-(--color-ink-soft)">
                  Book online in a few steps, or call the clinic directly — whichever is easier
                  for you.
                </p>
                <Button to="/appointment">Book an Appointment</Button>
              </div>
              <ToothMascot
                type="happy"
                frame="standing"
                size="md"
                className="max-sm:hidden lg:group-hover:-translate-y-1"
              />
            </div>

            <div className="flex flex-col items-center gap-4 border-t border-(--color-accent)/15 pt-8 text-center sm:flex-row sm:justify-center sm:text-left">
              <ToothMascot type="superhero" frame="standing" size="xs" />
              <div>
                <p className="text-sm font-medium text-(--color-ink)">Need help booking?</p>
                <a
                  href={telHref(clinic.phone)}
                  className="flex items-center justify-center gap-2 text-lg font-semibold text-(--color-accent) sm:justify-start"
                >
                  <Phone className="h-5 w-5" strokeWidth={1.75} />
                  {clinic.phone}
                </a>
                <p className="max-w-sm text-xs text-(--color-ink-faint)">
                  Contact this number to fix an appointment and be updated regularly on updates.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
