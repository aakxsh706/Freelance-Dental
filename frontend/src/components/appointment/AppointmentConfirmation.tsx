import belinLocationQr from '../../assets/BelinDental_Location_Qr_cropped.png'
import { getClinicSettings } from '../../api/clinic'
import { fallbackClinicSettings } from '../../data/clinicConfig'
import { useFetch } from '../../hooks/useFetch'
import { formatDateLong, formatTime12h, telHref } from '../../lib/format'
import type { Appointment } from '../../types'
import { Button } from '../ui/Button'
import { HappyToothCompanion } from './HappyToothCompanion'

export function AppointmentConfirmation({ appointment }: { appointment: Appointment }) {
  const { data: settings } = useFetch(getClinicSettings, [])
  const clinic = settings ?? fallbackClinicSettings

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 rounded-2xl border border-(--color-border) bg-(--color-bg) p-8 text-center sm:p-10">
      {/* The companion's "You're all set!" is a supplementary, celebratory
          caption — the heading and details below remain the actual,
          unchanged accessible confirmation content. */}
      <HappyToothCompanion state="success" />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-(--color-ink) sm:text-3xl">
          Appointment Request Submitted
        </h1>
        <p className="text-sm leading-relaxed text-(--color-ink-soft)">
          Thank you, {appointment.patient_name}. Your appointment request has been recorded.
        </p>
      </div>

      <dl className="grid w-full grid-cols-1 gap-3 rounded-xl bg-(--color-surface) p-6 text-left sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-(--color-ink-faint)">
            Patient
          </dt>
          <dd className="text-sm text-(--color-ink)">{appointment.patient_name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-(--color-ink-faint)">
            Date
          </dt>
          <dd className="text-sm text-(--color-ink)">
            {formatDateLong(appointment.appointment_date)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-(--color-ink-faint)">
            Time
          </dt>
          <dd className="text-sm text-(--color-ink)">
            {formatTime12h(appointment.appointment_time.slice(0, 5))}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-(--color-ink-faint)">
            Reason for Visit
          </dt>
          <dd className="text-sm text-(--color-ink)">{appointment.reason}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-(--color-ink-faint)">
            Clinic
          </dt>
          <dd className="text-sm text-(--color-ink)">
            {clinic.clinic_name} &middot;{' '}
            <a href={telHref(clinic.phone)} className="text-(--color-accent) hover:underline">
              {clinic.phone}
            </a>
          </dd>
        </div>
      </dl>

      <p className="text-xs text-(--color-ink-faint)">
        Please contact the clinic if you need to modify or cancel your appointment.
      </p>

      <div className="flex w-full flex-col items-center gap-3 border-t border-(--color-border) pt-6">
        <h2 className="text-xs font-semibold tracking-wide text-(--color-ink-faint) uppercase">
          Find Your Clinic
        </h2>
        <p className="text-sm font-medium text-(--color-ink)">Scan to open clinic location</p>
        {/* The supplied QR asset (BelinDental_Location_Qr.png) ships with a
            large flat white canvas around the code itself. A cropped copy
            (BelinDental_Location_Qr_cropped.png, generated once from the
            original — the QR modules themselves are untouched and verified
            to decode identically) trims that down to a normal quiet zone,
            and mix-blend-mode: multiply drops the remaining white so it
            reads as sitting directly on the card rather than inside a
            white box, since white * this near-white card background
            resolves back to the card's own color while black stays black. */}
        <img
          src={belinLocationQr}
          alt="QR code to open Dr. Belin's Dentistry location"
          draggable={false}
          className="h-36 w-36 object-contain sm:h-40 sm:w-40"
          style={{ mixBlendMode: 'multiply' }}
        />
        <p className="max-w-xs text-sm leading-relaxed text-(--color-ink-soft)">
          {clinic.address}
        </p>
        {clinic.google_maps_url && (
          <a
            href={clinic.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-(--color-accent) hover:underline"
          >
            Open in Google Maps
          </a>
        )}
      </div>

      <Button to="/" variant="secondary">
        Back to Home
      </Button>
    </div>
  )
}
