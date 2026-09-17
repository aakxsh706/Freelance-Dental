import { useState } from 'react'
import { cancelAppointment } from '../../api/appointments'
import { ApiError } from '../../api/client'
import type { Appointment, AppointmentActionResult } from '../../types'
import { ActionButton, Checkbox, ErrorNote, Field, Modal, TextInput } from './ui'

/** Cancelling keeps the appointment and its history - it is never deleted. */
interface CancelModalProps {
  appointment: Appointment
  open: boolean
  onClose: () => void
  onDone: (result: AppointmentActionResult) => void
}

/** Unmounted while closed, so each opening starts from clean state rather than
 * needing an effect to reset the previous one. */
export function CancelModal(props: CancelModalProps) {
  if (!props.open) return null
  return <CancelModalBody {...props} />
}

function CancelModalBody({ appointment, open, onClose, onDone }: CancelModalProps) {
  const [reason, setReason] = useState('')
  // A patient who was expecting to come in should be told. A pending request
  // the clinic never accepted is a different thing, so the default follows the
  // appointment's state rather than always being on.
  const [notify, setNotify] = useState(
    appointment.status === 'confirmed' || appointment.status === 'checked_in',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      onDone(await cancelAppointment(appointment.id, reason, notify))
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel this appointment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title="Cancel Appointment" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-(--color-ink-soft)">
          The appointment is kept on the patient&rsquo;s record as cancelled, not deleted, and the
          time becomes bookable again.
        </p>
        <Field label="Reason" hint="Shown on the appointment history.">
          <TextInput
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Patient requested cancellation"
          />
        </Field>
        <Checkbox
          label="Email the patient about the cancellation"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <ActionButton onClick={onClose}>Keep Appointment</ActionButton>
          <ActionButton tone="danger" disabled={saving} onClick={submit}>
            {saving ? 'Cancelling…' : 'Cancel Appointment'}
          </ActionButton>
        </div>
      </div>
    </Modal>
  )
}
