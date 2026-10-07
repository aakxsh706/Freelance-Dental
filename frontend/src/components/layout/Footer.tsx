import { Link } from 'react-router-dom'
import { getClinicSettings } from '../../api/clinic'
import { fallbackClinicSettings } from '../../data/clinicConfig'
import { useFetch } from '../../hooks/useFetch'
import { useSectionNav } from '../../hooks/useSectionNav'
import { telHref } from '../../lib/format'
import { Container } from '../ui/Container'

const footerLinks = [
  { label: 'Services', id: 'services' },
  { label: 'Appointment', id: 'appointment' },
  { label: 'About', id: 'about' },
  { label: 'Contact Us', id: 'contact' },
  { label: 'FAQ', id: 'faq' },
]

export function Footer() {
  const { goToSection } = useSectionNav()
  const { data: settings } = useFetch(getClinicSettings, [])
  const clinic = settings ?? fallbackClinicSettings

  return (
    <footer className="border-t border-(--color-border) bg-(--color-surface)">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="font-display text-lg font-semibold text-(--color-ink)">
            Dr. Belin&rsquo;s Dentistry
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-(--color-ink-soft)">
            Personalized dental care designed around your comfort, confidence, and long-term
            oral health.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-(--color-ink)">Navigation</h3>
          <ul className="mt-4 flex flex-col gap-3">
            {footerLinks.map((link) => (
              <li key={link.id}>
                <button
                  onClick={() => goToSection(link.id)}
                  className="text-sm text-(--color-ink-soft) hover:text-(--color-accent)"
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-(--color-ink)">Contact</h3>
          <p className="mt-4 text-sm text-(--color-ink-soft)">
            <a href={telHref(clinic.phone)} className="hover:text-(--color-accent)">
              {clinic.phone}
            </a>
          </p>
          {clinic.email && (
            <p className="mt-2 text-sm text-(--color-ink-soft)">
              <a href={`mailto:${clinic.email}`} className="hover:text-(--color-accent)">
                {clinic.email}
              </a>
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-(--color-ink)">Location</h3>
          <p className="mt-4 text-sm leading-relaxed text-(--color-ink-soft)">{clinic.address}</p>
        </div>
      </Container>

      <div className="border-t border-(--color-border) py-6">
        <Container>
          <p className="text-center text-xs text-(--color-ink-faint)">
            © 2026 Dr. Belin&rsquo;s Dentistry. All rights reserved.
          </p>
        </Container>
      </div>
    </footer>
  )
}
