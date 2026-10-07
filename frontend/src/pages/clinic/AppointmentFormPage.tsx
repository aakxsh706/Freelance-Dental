import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createStaffAppointment } from '../../api/appointments'
import { getAvailability } from '../../api/availability'
import { ApiError, fieldErrors } from '../../api/client'
import { getPatient } from '../../api/patients'
import { PatientPicker } from '../../components/clinic/PatientPicker'
import {
  ActionButton,
  Card,
  CardTitle,
  ErrorNote,
  Field,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from '../../components/clinic/ui'
import { useFetch } from '../../hooks/useFetch'
import { formatTime12h, todayIso } from '../../lib/format'
import type { PatientListRow } from '../../types/clinic'
import type { TimeSlot } from '../../types'

/**
 * Book an appointment from inside the clinic.
 *
 * Uses the same availability endpoint the public site does, so working hours,
 * holidays and existing bookings are enforced identically — there is only one
 * definition of "is this slot free".
 */
export function AppointmentFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [patient, setPatient] = useState<PatientListRow | null>(null)
  const [walkInName, setWalkInName] = useState('')
  const [walkInPhone, setWalkInPhone] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(todayIso())
  const [time, setTime] = useState('')
  const [source, setSource] = useState('clinic')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Preselect the patient when arriving from their profile.
  useEffect(() => {
    const preset = searchParams.get('patient')
    if (!preset) return
    getPatient(preset)
      .then((p) =>
        setPatient({
          uuid: p.uuid,
          patient_code: p.patient_code,
          full_name: p.full_name,
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          email: p.email,
          date_of_birth: p.date_of_birth,
          age: p.age,
          gender: p.gender,
          is_active: p.is_active,
          last_visit_date: null,
          next_appointment_date: null,
          created_at: p.created_at,
        }),
      )
      .catch(() => undefined)
  }, [searchParams])

  // Same availability endpoint the public booking flow uses, so working hours,
  // holidays and existing bookings are enforced from one place.
  const { data: availability, loading: slotsLoading } = useFetch(
    () => getAvailability(date),
    [date],
  )
  const slots: TimeSlot[] = availability?.slots ?? []

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setErrors({})
    try {
      const created = await createStaffAppointment({
        patient: patient?.uuid ?? null,
        patient_name: patient ? undefined : walkInName,
        phone: patient ? undefined : walkInPhone,
        reason,
        appointment_date: date,
        appointment_time: time,
        notes,
        source,
        status: 'confirmed',
      })
      navigate(
        created.patient ? `/clinic/patients/${created.patient.uuid}` : '/clinic/appointments',
      )
    } catch (err) {
      setErrors(fieldErrors(err))
      setError(err instanceof ApiError ? err.message : 'Could not book this appointment.')
    } finally {
      setSaving(false)
    }
  }

  const available = slots.filter((slot) => slot.status === 'available')

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        title="New Appointment"
        subtitle="Booked from the clinic. Slot availability follows the same rules as the website."
        actions={
          <>
            <ActionButton type="button" onClick={() => navigate(-1)}>
              Cancel
            </ActionButton>
            <ActionButton tone="primary" type="submit" disabled={saving || !time || !reason}>
              {saving ? 'Booking…' : 'Book Appointment'}
            </ActionButton>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Patient</CardTitle>
          <Field label="Existing patient" hint="Leave empty for someone not yet on file.">
            <PatientPicker value={patient} onSelect={setPatient} />
          </Field>

          {!patient && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Name" required error={errors.patient_name}>
                <TextInput value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
              </Field>
              <Field label="Phone" error={errors.phone}>
                <TextInput value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} />
              </Field>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Reason for Visit" required error={errors.reason} className="sm:col-span-2">
              <TextInput
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Routine check-up"
                required
              />
            </Field>
            <Field label="Booked Via">
              <Select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="clinic">Clinic</option>
                <option value="phone">Phone</option>
                <option value="walk_in">Walk-in</option>
                <option value="other">Other</option>
              </Select>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Notes">
              <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Date &amp; Time</CardTitle>
          <Field label="Date" required error={errors.appointment_date}>
            <TextInput
              type="date"
              value={date}
              min={todayIso()}
              onChange={(e) => {
                setDate(e.target.value)
                // A slot chosen for the old date is meaningless on the new one.
                setTime('')
              }}
              required
            />
          </Field>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-(--color-ink)">
              Available Slots
              <span className="ml-1 text-xs font-normal text-(--color-ink-faint)">required</span>
            </p>
            {slotsLoading && <p className="text-sm text-(--color-ink-soft)">Checking…</p>}
            {!slotsLoading && slots.length === 0 && (
              <p className="text-sm text-(--color-ink-soft)">
                The clinic is closed on this date, or no working hours are configured for it.
              </p>
            )}
            {!slotsLoading && slots.length > 0 && available.length === 0 && (
              <p className="text-sm text-(--color-ink-soft)">
                Every slot on this date is already booked.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {available.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => setTime(slot.time)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    time === slot.time
                      ? 'border-(--color-accent) bg-(--color-accent) text-white'
                      : 'border-(--color-border) text-(--color-ink) hover:border-(--color-accent)/50'
                  }`}
                >
                  {formatTime12h(slot.time)}
                </button>
              ))}
            </div>
            {errors.appointment_time && (
              <p className="mt-2 text-xs text-(--color-danger)">{errors.appointment_time}</p>
            )}
          </div>
        </Card>
      </div>
    </form>
  )
}
