import type { ClinicSettings, Dentist } from '../types'

/**
 * Fallback values shown while the live /api/clinic/settings/ and
 * /api/dentist/profile/ requests are loading, or if they fail. Keep these in
 * sync with the placeholder defaults seeded on the backend
 * (clinic/management/commands/seed_clinic.py) so the site never flashes
 * mismatched placeholder content.
 */
export const fallbackClinicSettings: ClinicSettings = {
  clinic_name: "Belin's Dental Clinic",
  phone: '+91 XXXXX XXXXX',
  email: 'info@belinsdental.example',
  address: 'Clinic Address — Placeholder, City, State, PIN',
  google_maps_embed_url: '',
  google_maps_url: '',
  slot_duration_minutes: 30,
}

export const fallbackDentist: Dentist = {
  id: 0,
  name: 'Dr. Belin [Placeholder]',
  title: 'Dentist & Oral Healthcare Professional',
  email: '',
  phone: '+91 XXXXX XXXXX',
  bio: 'Dr. Belin focuses on patient comfort, preventive care, and clear communication — helping every patient understand their treatment options and make confident decisions about their oral health for the long term.',
  profile_image: '',
}

export const clinicNavLinks = [
  { label: 'Services', href: '#services' },
  { label: 'Appointment', href: '#appointment' },
  { label: 'About', href: '#about' },
  { label: 'Contact Us', href: '#contact' },
]
