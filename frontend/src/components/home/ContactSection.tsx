import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { getClinicSettings } from '../../api/clinic'
import { clinicTimings, fallbackClinicSettings } from '../../data/clinicConfig'
import { useFetch } from '../../hooks/useFetch'
import { telHref } from '../../lib/format'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

export function ContactSection() {
  const { data: settings } = useFetch(getClinicSettings, [])
  const clinic = settings ?? fallbackClinicSettings

  const items = [
    { icon: Phone, label: 'Phone', value: clinic.phone, href: telHref(clinic.phone) },
    { icon: Mail, label: 'Email', value: clinic.email, href: `mailto:${clinic.email}` },
    { icon: MapPin, label: 'Address', value: clinic.address },
    {
      icon: Clock,
      label: 'Hours',
      value: `Mon–Sat, ${clinicTimings.map((session) => session.hours).join(' & ')}`,
    },
  ]

  return (
    <section id="contact" className="scroll-mt-20 py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <Reveal className="mx-auto">
          <SectionHeading eyebrow="Contact Us" title="We're Here to Help" />
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <Reveal key={item.label} delay={index * 50} as="article">
              <div className="flex h-full flex-col items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-6 text-center">
                <item.icon className="h-6 w-6 text-(--color-accent)" strokeWidth={1.5} />
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-(--color-ink-faint)">
                  {item.label}
                </h3>
                {item.href ? (
                  <a href={item.href} className="text-sm font-medium text-(--color-ink) hover:text-(--color-accent)">
                    {item.value}
                  </a>
                ) : (
                  <p className="text-sm text-(--color-ink-soft)">{item.value}</p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
