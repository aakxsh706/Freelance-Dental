import { useState } from 'react'
import { updateAppointmentStatus } from '../../api/appointments'
import { ApiError } from '../../api/client'
import type { Appointment, AppointmentStatus } from '../../types'
import { ActionButton } from './ui'

/** Which moves are offered from each status.
 *
 * Mirrors the server's transition table so the interface never presents a
 * button that would be rejected. Terminal states offer nothing - a completed
 * appointment is history, not a draft. */
const NEXT_ACTIONS: Record<AppointmentStatus, { to: AppointmentStatus; label: string; tone?: 'primary' | 'secondary' | 'danger' }[]> = {
  pending: [
    { to: 'confirmed', label: 'Confirm', tone: 'primary' },
    { to: 'cancelled', label: 'Cancel', tone: 'danger' },
  ],
  confirmed: [
    { to: 'checked_in', label: 'Check In', tone: 'primary' },
    { to: 'no_show', label: 'No Show' },
    { to: 'cancelled', label: 'Cancel', tone: 'danger' },
  ],
  checked_in: [
    { to: 'completed', label: 'Complete', tone: 'primary' },
    { to: 'no_show', label: 'No Show' },
  ],
  completed: [],
  cancelled: [],
  no_show: [],
}

export function AppointmentStatusControl({
  appointment,
  onChanged,
  compact = false,
}: {
  appointment: Appointment
  onChanged: (updated: Appointment) => void
  compact?: boolean
}) {
  const [busy, setBusy] = useState<AppointmentStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const actions = NEXT_ACTIONS[appointment.status] ?? []
  if (actions.length === 0) return null

  async function move(to: AppointmentStatus) {
    setBusy(to)
    setError(null)
    try {
      const updated = await updateAppointmentStatus(appointment.id, to)
      onChanged(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this appointment.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map((action) => (
          <ActionButton
            key={action.to}
            tone={action.tone ?? 'secondary'}
            disabled={busy !== null}
            onClick={() => move(action.to)}
            className={compact ? 'px-2.5 py-1.5 text-xs' : ''}
          >
            {busy === action.to ? '…' : action.label}
          </ActionButton>
        ))}
      </div>
      {error && <span className="text-xs text-(--color-danger)">{error}</span>}
    </div>
  )
}
