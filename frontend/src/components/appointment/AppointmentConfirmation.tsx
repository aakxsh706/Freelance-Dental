import { Clock3, Mail } from 'lucide-react'
import { getClinicSettings } from '../../api/clinic'
import { fallbackClinicSettings } from '../../data/clinicConfig'
import { useFetch } from '../../hooks/useFetch'
import { formatDateLong, formatTime12h, telHref } from '../../lib/format'
import type { Appointment } from '../../types'
import { Button } from '../ui/Button'
import { ToothMascot } from '../ui/ToothMascot'

export function AppointmentConfirmation({ appointment }: { appointment: Appointment }) {
  const { data: settings } = useFetch(getClinicSettings, [])
  const clinic = settings ?? fallbackClinicSettings

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 rounded-2xl border border-(--color-border) bg-(--color-bg) p-8 text-center sm:p-10">
      <div className="relative">
        <ToothMascot type="happy" frame="standing" size="lg" decorative={false} />
        <Clock3
          className="absolute right-2 bottom-2 h-8 w-8 rounded-full bg-(--color-bg) text-amber-600"
          strokeWidth={1.75}
        />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-(--color-ink) sm:text-3xl">
          Appointment Request Submitted
        </h1>
        <p className="text-sm leading-relaxed text-(--color-ink-soft)">
          Thank you, {appointment.patient_name}. Your request has been sent to{' '}
          {clinic.clinic_name}.
        </p>
      </div>

      {/* The whole point of this screen: requested is not the same as booked.
          Stated in its own banner rather than as a line of body text, because
          a patient who skims and assumes they are booked may not turn up. */}
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
