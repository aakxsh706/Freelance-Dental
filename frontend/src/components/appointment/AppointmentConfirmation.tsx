import { CheckCircle2 } from 'lucide-react'
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
        <CheckCircle2
          className="absolute right-2 bottom-2 h-8 w-8 rounded-full bg-(--color-bg) text-(--color-accent)"
          strokeWidth={1.5}
        />
      </div>
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

      <Button to="/" variant="secondary">
        Back to Home
      </Button>
    </div>
  )
}
