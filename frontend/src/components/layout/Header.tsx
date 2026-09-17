import { Menu, Phone, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getClinicSettings } from '../../api/clinic'
import { fallbackClinicSettings } from '../../data/clinicConfig'
import { useFetch } from '../../hooks/useFetch'
import { useSectionNav } from '../../hooks/useSectionNav'
import { telHref } from '../../lib/format'
import { Button } from '../ui/Button'

const navItems = [
  { label: 'Services', id: 'services' },
  { label: 'Appointment', id: 'appointment' },
  { label: 'About', id: 'about' },
  { label: 'Contact Us', id: 'contact' },
]

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { goToSection } = useSectionNav()
  const { data: settings } = useFetch(getClinicSettings, [])
  const clinic = settings ?? fallbackClinicSettings

  function handleNavClick(id: string) {
    setMenuOpen(false)
    goToSection(id)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-(--color-border) bg-(--color-bg)/90 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
        <Link to="/" className="font-display text-lg font-semibold text-(--color-ink) sm:text-xl">
          Dr. Belin&rsquo;s Dentistry
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className="text-sm font-medium text-(--color-ink-soft) transition-colors hover:text-(--color-accent)"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <a
            href={telHref(clinic.phone)}
            className="flex items-center gap-2 text-sm font-medium text-(--color-ink-soft) hover:text-(--color-accent)"
          >
            <Phone className="h-4 w-4" strokeWidth={1.75} />
            {clinic.phone}
          </a>
          <Button to="/appointment" className="!py-2.5">
            Book an Appointment
          </Button>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-full border border-(--color-border) lg:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-(--color-border) bg-(--color-bg) px-6 py-6 lg:hidden">
          <nav className="flex flex-col gap-4">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="text-left text-base font-medium text-(--color-ink)"
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-6 flex flex-col gap-4">
            <a
              href={telHref(clinic.phone)}
              className="flex items-center gap-2 text-sm font-medium text-(--color-ink-soft)"
            >
              <Phone className="h-4 w-4" strokeWidth={1.75} />
              {clinic.phone}
            </a>
            <Button to="/appointment" className="w-full" onClick={() => setMenuOpen(false)}>
              Book an Appointment
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
