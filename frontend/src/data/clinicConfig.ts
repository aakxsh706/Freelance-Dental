import type { ClinicSettings, Dentist } from '../types'

/**
 * Fallback values shown while the live /api/clinic/settings/ and
 * /api/dentist/profile/ requests are loading, or if they fail. Keep these in
 * sync with the placeholder defaults seeded on the backend
 * (clinic/management/commands/seed_clinic.py) so the site never flashes
 * mismatched placeholder content.
 */
export const fallbackClinicSettings: ClinicSettings = {
  clinic_name: "Dr. Belin's Dentistry",
  phone: '+91 88707 74432',
  email: 'belindentistry@gmail.com',
  address:
    'No. 23, SS Towers, Kurumbapalayam, Sathy road, Sarkarsamakulam PO, Coimbatore 641107, Tamilnadu',
  google_maps_embed_url:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d500!2d77.0214229!3d11.1014248!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ba8f94e0565a521%3A0x4741f01b6c83c8b3!2sDr.%20Belin%27s%20Dentistry!5e0!3m2!1sen!2sin!4v1759150000000!5m2!1sen!2sin',
  google_maps_url: 'https://maps.app.goo.gl/1sA41VZLgnzXNse86',
  slot_duration_minutes: 30,
}

export const fallbackDentist: Dentist = {
  id: 0,
  name: 'Dr. Belin Roshia',
  title: 'Dentist & Oral Healthcare Professional',
  email: '',
  phone: '+91 88707 74432',
  bio: 'Dr. Belin focuses on patient comfort, preventive care, and clear communication — helping every patient understand their treatment options and make confident decisions about their oral health for the long term.',
  profile_image: '',
}

export const clinicNavLinks = [
  { label: 'Services', href: '#services' },
  { label: 'Appointment', href: '#appointment' },
  { label: 'About', href: '#about' },
  { label: 'Contact Us', href: '#contact' },
]

/** Static display copy for the clinic's two daily sessions — keep in sync
 * with the DentistAvailability windows configured on the backend
 * (clinic/migrations/0002_real_clinic_info_and_hours.py / the dentist
 * dashboard's Availability manager). */
export const clinicTimings = [
  { label: 'Morning', hours: '10:00 AM – 2:00 PM' },
  { label: 'Evening', hours: '4:30 PM – 8:00 PM' },
]
