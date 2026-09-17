import { Clock3, Mail } from 'lucide-react'
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
      {/* The companion's caption is a supplementary, friendly note — the
          heading, banner and details below remain the actual accessible
          content, and are what state the appointment is not yet booked. */}
      <HappyToothCompanion state="success" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-(--color-ink) sm:text-3xl">
          Appointment Request Submitted
        </h1>
        <p className="text-sm leading-relaxed text-(--color-ink-soft)">
          Thank you, {appointment.patient_name}. Your request has been sent to {clinic.clinic_name}.
        </p>
      </div>

      {/* The whole point of this screen: requested is not the same as booked.
          Given its own banner rather than a line of body text, because a
          patient who skims and assumes they are booked may not turn up — or
          may turn up on a day the clinic never agreed to. */}
      <div className="flex w-full items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" strokeWidth={2} />
        <div>
          <p className="text-sm font-semibold text-(--color-ink)">
            Awaiting confirmation &mdash; not booked yet
          </p>
          <p className="mt-0.5 text-sm text-(--color-ink-soft)">
            The clinic will review your request and confirm your appointment. Please do not travel
            to the clinic until you have received a confirmation.
          </p>
        </div>
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
            Requested Date
          </dt>
          <dd className="text-sm text-(--color-ink)">
            {formatDateLong(appointment.appointment_date)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-(--color-ink-faint)">
            Requested Time
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

      {appointment.email ? (
        <div className="flex w-full items-start gap-3 rounded-xl bg-(--color-accent-soft) px-4 py-3 text-left">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-(--color-accent)" strokeWidth={1.75} />
          <p className="text-sm text-(--color-ink)">
            We will email you at{' '}
            <span className="font-medium break-all">{appointment.email}</span> once your
            appointment is confirmed.
          </p>
        </div>
      ) : (
        <div className="flex w-full items-start gap-3 rounded-xl bg-(--color-surface) px-4 py-3 text-left">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-(--color-ink-faint)" strokeWidth={1.75} />
          <p className="text-sm text-(--color-ink-soft)">
            You did not provide an email address, so the clinic will contact you on{' '}
            <span className="font-medium text-(--color-ink)">{appointment.phone}</span> to confirm.
          </p>
        </div>
      )}

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
          alt={`QR code to open ${clinic.clinic_name} location`}
          draggable={false}
          className="h-36 w-36 object-contain sm:h-40 sm:w-40"
          style={{ mixBlendMode: 'multiply' }}
        />
        <p className="max-w-xs text-sm leading-relaxed text-(--color-ink-soft)">{clinic.address}</p>
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

      <p className="text-xs text-(--color-ink-faint)">
        Please contact the clinic on{' '}
        <a href={telHref(clinic.phone)} className="text-(--color-accent) hover:underline">
          {clinic.phone}
        </a>{' '}
        if you need to change or cancel this request.
      </p>

      <Button to="/" variant="secondary">
        Back to Home
      </Button>
    </div>
  )
}
