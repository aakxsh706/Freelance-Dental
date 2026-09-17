import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { asSlotConflict, rescheduleAppointment } from '../../api/appointments'
import { getAvailability } from '../../api/availability'
import { ApiError } from '../../api/client'
import { useFetch } from '../../hooks/useFetch'
import { formatDateLong, formatTime12h, formatTimeOfDay, todayIso } from '../../lib/format'
import type { Appointment, AppointmentActionResult, SlotConflictInfo, TimeSlot } from '../../types'
import { ActionButton, ErrorNote, Field, Modal, TextInput } from './ui'

/**
 * Moving an appointment to another date or time.
 *
 * Shows the current schedule alongside the new one, because "what am I
 * changing it from" is the first thing the person on the phone asks. The
 * reason is required - a moved appointment with no recorded reason is exactly
 * the record that is useless three months later when it is queried.
 *
 * A clash is not an error message: it names who already holds the slot and,
 * where the signed-in user is allowed to, offers a reasoned override.
 */
interface RescheduleModalProps {
  appointment: Appointment
  open: boolean
  onClose: () => void
  onDone: (result: AppointmentActionResult) => void
}

/** Unmounted while closed: each opening starts from the appointment's current
 * schedule, with no effect needed to reset the previous attempt. */
export function RescheduleModal(props: RescheduleModalProps) {
  if (!props.open) return null
  return <RescheduleModalBody {...props} />
}

function RescheduleModalBody({ appointment, open, onClose, onDone }: RescheduleModalProps) {
  const [date, setDate] = useState(appointment.appointment_date)
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<SlotConflictInfo | null>(null)
  const [overrideReason, setOverrideReason] = useState('')

  // Same availability service the public booking form uses, so working hours,
  // holidays and existing bookings are enforced from one definition.
  const { data: availability, loading: loadingSlots } = useFetch(
    () => getAvailability(date),
    [date],
  )
  const slots: TimeSlot[] = availability?.slots ?? []

  async function submit(withOverride: boolean) {
    setSaving(true)
    setError(null)
    try {
      const result = await rescheduleAppointment(appointment.id, {
        appointment_date: date,
        appointment_time: time,
        reason,
        ...(withOverride ? { override: true, override_reason: overrideReason } : {}),
      })
      onDone(result)
      onClose()
    } catch (err) {
      const clash = asSlotConflict(err)
      if (clash) {
        setConflict(clash)
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not reschedule this appointment.')
      }
    } finally {
      setSaving(false)
    }
  }

  const available = slots.filter((slot) => slot.status === 'available')
  // A taken slot is still selectable: choosing it is how staff reach the
  // override path deliberately, rather than being told "no" with no way on.
  const taken = slots.filter((slot) => slot.status === 'booked')

  return (
    <Modal open={open} title="Reschedule Appointment" onClose={onClose} width="max-w-xl">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
          <p className="text-sm font-medium text-(--color-ink)">{appointment.patient_name}</p>
          <p className="mt-0.5 text-xs uppercase tracking-wide text-(--color-ink-faint)">
            Current appointment
          </p>
          <p className="text-sm text-(--color-ink)">
            {formatDateLong(appointment.appointment_date)} ·{' '}
            {formatTimeOfDay(appointment.appointment_time)}
          </p>
        </div>

        <Field label="New Date" required>
          <TextInput
            type="date"
            value={date}
            min={todayIso()}
            onChange={(e) => {
              setDate(e.target.value)
              setTime('')
              setConflict(null)
            }}
          />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-(--color-ink)">
            New Time <span className="text-(--color-danger)">*</span>
          </p>
          {loadingSlots && <p className="text-sm text-(--color-ink-soft)">Checking availability…</p>}
          {!loadingSlots && slots.length === 0 && (
            <p className="text-sm text-(--color-ink-soft)">
              The clinic is closed on this date, or no working hours are set for it.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {available.map((slot) => (
              <button
                key={slot.time}
                type="button"
                onClick={() => {
                  setTime(slot.time)
                  setConflict(null)
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  time === slot.time
                    ? 'border-(--color-accent) bg-(--color-accent) text-white'
                    : 'border-(--color-border) text-(--color-ink) hover:border-(--color-accent)/50'
                }`}
              >
                {formatTime12h(slot.time)}
              </button>
            ))}
            {taken.map((slot) => (
              <button
                key={slot.time}
                type="button"
                title="Already booked — selecting this will ask you to override"
                onClick={() => {
                  setTime(slot.time)
                  setConflict(null)
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium line-through transition-colors ${
                  time === slot.time
                    ? 'border-amber-400 bg-amber-100 text-amber-900'
                    : 'border-(--color-border) text-(--color-ink-faint) hover:border-amber-300'
                }`}
              >
                {formatTime12h(slot.time)}
              </button>
            ))}
          </div>
        </div>

        <Field label="Reason for Rescheduling" required>
          <TextInput
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Patient requested another time"
          />
        </Field>

        {conflict && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-(--color-ink)">
              <AlertTriangle className="h-4 w-4 text-amber-700" strokeWidth={2} />
              This time slot is already occupied.
            </p>
            <div className="mt-2 rounded border border-amber-200 bg-white px-3 py-2 text-sm">
              <p className="font-medium text-(--color-ink)">{conflict.conflict.patient_name}</p>
              <p className="text-(--color-ink-soft)">
                {formatTimeOfDay(conflict.conflict.appointment_time)} ·{' '}
                {conflict.conflict.status_display}
                {conflict.conflict.reason ? ` · ${conflict.conflict.reason}` : ''}
              </p>
            </div>

            {conflict.can_override ? (
              <div className="mt-3">
                <Field label="Override Reason" required>
                  <TextInput
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Emergency tooth pain"
                  />
                </Field>
                <div className="mt-2 flex gap-2">
                  <ActionButton onClick={() => setConflict(null)}>Choose Another Time</ActionButton>
                  <ActionButton
                    tone="primary"
                    disabled={!overrideReason.trim() || saving}
                    onClick={() => submit(true)}
                  >
                    {saving ? 'Saving…' : 'Override and Book'}
                  </ActionButton>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-(--color-ink-soft)">
                Your role cannot book over an existing appointment. Choose another time, or ask a
                dentist or administrator.
              </p>
            )}
          </div>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        {!conflict && (
          <div className="flex justify-end gap-2">
            <ActionButton onClick={onClose}>Cancel</ActionButton>
            <ActionButton
              tone="primary"
              disabled={!time || !reason.trim() || saving}
              onClick={() => submit(false)}
            >
              {saving ? 'Rescheduling…' : 'Confirm Reschedule'}
            </ActionButton>
          </div>
        )}
      </div>
    </Modal>
  )
}
