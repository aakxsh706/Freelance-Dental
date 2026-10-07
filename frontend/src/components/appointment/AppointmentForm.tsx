import type { FormEvent } from 'react'
import { useState } from 'react'
import { todayIso } from '../../lib/format'
import type { PatientDetails } from '../../stores/bookingStore'
import { Button } from '../ui/Button'

interface AppointmentFormProps {
  initialDetails: PatientDetails
  initialPreferredDate: string | null
  onContinue: (details: PatientDetails, preferredDate: string) => void
}

interface FormErrors {
  patient_name?: string
  phone?: string
  email?: string
  reason?: string
  preferredDate?: string
}

const PHONE_PATTERN = /^[+]?[\d\s-]{7,15}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(details: PatientDetails, preferredDate: string): FormErrors {
  const errors: FormErrors = {}
  if (!details.patient_name.trim()) errors.patient_name = 'Please enter your name.'
  if (!details.phone.trim()) {
    errors.phone = 'Please enter a phone number.'
  } else if (!PHONE_PATTERN.test(details.phone.trim())) {
    errors.phone = 'Please enter a valid phone number.'
  }
  if (details.email.trim() && !EMAIL_PATTERN.test(details.email.trim())) {
    errors.email = 'Please enter a valid email address.'
  }
  if (!details.reason.trim()) errors.reason = 'Please tell us the reason for your visit.'
  if (!preferredDate) {
    errors.preferredDate = 'Please choose a preferred date.'
  } else if (preferredDate < todayIso()) {
    errors.preferredDate = 'Please choose a date that is today or in the future.'
  }
  return errors
}

export function AppointmentForm({
  initialDetails,
  initialPreferredDate,
  onContinue,
}: AppointmentFormProps) {
  const [details, setDetails] = useState<PatientDetails>(initialDetails)
  const [preferredDate, setPreferredDate] = useState(initialPreferredDate ?? '')
  const [errors, setErrors] = useState<FormErrors>({})

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const validationErrors = validate(details, preferredDate)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length === 0) {
      onContinue(details, preferredDate)
    }
  }

  function field(name: keyof PatientDetails, value: string) {
    setDetails((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="patient_name" className="text-sm font-medium text-(--color-ink)">
            Patient Name
          </label>
          <input
            id="patient_name"
            value={details.patient_name}
            onChange={(e) => field('patient_name', e.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-bg) px-4 py-3 text-sm outline-none focus:border-(--color-accent)"
            placeholder="Full name"
          />
          {errors.patient_name && <p className="text-xs text-(--color-danger)">{errors.patient_name}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="phone" className="text-sm font-medium text-(--color-ink)">
            Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            value={details.phone}
            onChange={(e) => field('phone', e.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-bg) px-4 py-3 text-sm outline-none focus:border-(--color-accent)"
            placeholder="+91 XXXXX XXXXX"
          />
          {errors.phone && <p className="text-xs text-(--color-danger)">{errors.phone}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium text-(--color-ink)">
            Email <span className="text-(--color-ink-faint)">(optional)</span>
          </label>
          <input
            id="email"
            type="email"
            value={details.email}
            onChange={(e) => field('email', e.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-bg) px-4 py-3 text-sm outline-none focus:border-(--color-accent)"
            placeholder="you@example.com"
          />
          {errors.email && <p className="text-xs text-(--color-danger)">{errors.email}</p>}
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="reason" className="text-sm font-medium text-(--color-ink)">
            Reason for Visit
          </label>
          <input
            id="reason"
            value={details.reason}
            onChange={(e) => field('reason', e.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-bg) px-4 py-3 text-sm outline-none focus:border-(--color-accent)"
            placeholder="e.g. Routine check-up, tooth pain, cleaning"
          />
          {errors.reason && <p className="text-xs text-(--color-danger)">{errors.reason}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="preferredDate" className="text-sm font-medium text-(--color-ink)">
            Preferred Date
          </label>
          <input
            id="preferredDate"
            type="date"
            min={todayIso()}
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-bg) px-4 py-3 text-sm outline-none focus:border-(--color-accent)"
          />
          {errors.preferredDate && (
            <p className="text-xs text-(--color-danger)">{errors.preferredDate}</p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="notes" className="text-sm font-medium text-(--color-ink)">
            Additional Notes <span className="text-(--color-ink-faint)">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={details.notes}
            onChange={(e) => field('notes', e.target.value)}
            rows={3}
            className="resize-none rounded-lg border border-(--color-border) bg-(--color-bg) px-4 py-3 text-sm outline-none focus:border-(--color-accent)"
            placeholder="Anything else the dentist should know"
          />
        </div>
      </div>

      <Button type="submit" className="self-start">
        Continue to Schedule
      </Button>
    </form>
  )
}
