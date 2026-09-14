import { MapPin } from 'lucide-react'
import { getClinicSettings } from '../../api/clinic'
import { fallbackClinicSettings } from '../../data/clinicConfig'
import { useFetch } from '../../hooks/useFetch'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

export function LocationMap() {
  const { data: settings, error } = useFetch(getClinicSettings, [])
  const clinic = settings ?? fallbackClinicSettings
  const hasRealEmbed = Boolean(clinic.google_maps_embed_url)

  return (
    <section id="location" className="scroll-mt-20 py-20 sm:py-24">
      <Container className="flex flex-col gap-10">
        <Reveal className="mx-auto">
          <SectionHeading
            eyebrow="Clinic Location"
            title="Visit Our Clinic"
            description={clinic.address}
          />
        </Reveal>

        <Reveal>
          {error ? (
            <div className="flex aspect-[16/7] w-full items-center justify-center rounded-2xl border border-(--color-border) bg-(--color-surface) text-sm text-(--color-ink-soft)">
              Map is unavailable right now. Please try again later.
            </div>
          ) : hasRealEmbed ? (
            <iframe
              title="Belin's Dental Clinic location"
              src={clinic.google_maps_embed_url}
              className="aspect-[16/7] w-full rounded-2xl border border-(--color-border)"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface) text-center">
              <MapPin className="h-8 w-8 text-(--color-accent)" strokeWidth={1.5} />
              <p className="text-sm text-(--color-ink-soft)">
                An interactive map will appear here once the clinic&rsquo;s real address and
                Google Maps link are provided.
              </p>
            </div>
          )}
        </Reveal>

        {clinic.google_maps_url && (
          <a
            href={clinic.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-auto text-sm font-medium text-(--color-accent) hover:underline"
          >
            Open in Google Maps
          </a>
        )}
      </Container>
    </section>
  )
}
