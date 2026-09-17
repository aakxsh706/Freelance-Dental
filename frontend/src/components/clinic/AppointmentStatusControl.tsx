import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  checkInAppointment,
  confirmAppointment,
  updateAppointmentStatus,
} from '../../api/appointments'
import { ApiError } from '../../api/client'
import type { Appointment, AppointmentStatus, NotificationOutcome } from '../../types'
import { ActionButton } from './ui'

/**
 * The one-click actions for an appointment row.
 *
 * Every action here goes through the endpoint that owns it rather than a
 * generic status PATCH. That matters: confirming through the confirm endpoint
 * emails the patient and stamps who accepted it, while a bare status change
 * would silently do neither - an appointment marked confirmed that the patient
 * was never told about is worse than one still showing as pending.
 *
 * Cancelling is deliberately absent. It needs a reason and a decision about
 * whether to email, so it lives on the appointment page where there is room to
 * ask, not as a one-click button in a dense row.
 */

type ActionKey = 'accept' | 'check_in' | 'complete' | 'no_show'

interface ActionSpec {
  key: ActionKey
  label: string
  tone?: 'primary' | 'secondary' | 'danger'
}

const ACTIONS_BY_STATUS: Record<AppointmentStatus, ActionSpec[]> = {
  pending: [{ key: 'accept', label: 'Accept', tone: 'primary' }],
  confirmed: [
    { key: 'check_in', label: 'Check In', tone: 'primary' },
    { key: 'no_show', label: 'No Show' },
  ],
  checked_in: [
    { key: 'complete', label: 'Complete', tone: 'primary' },
    { key: 'no_show', label: 'No Show' },
  ],
  completed: [],
  cancelled: [],
  no_show: [],
}

export function AppointmentStatusControl({
  appointment,
  onChanged,
  onNotification,
  compact = false,
}: {
  appointment: Appointment
  onChanged: (updated: Appointment) => void
  /** Lets the parent surface whether the patient's email actually went out. */
  onNotification?: (outcome: NotificationOutcome) => void
  compact?: boolean
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState<ActionKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const actions = ACTIONS_BY_STATUS[appointment.status] ?? []
  if (actions.length === 0) return null

  async function run(key: ActionKey) {
    setBusy(key)
    setError(null)
    try {
      if (key === 'accept') {
        const result = await confirmAppointment(appointment.id)
        onChanged(result.appointment)
        onNotification?.(result.notification)
      } else if (key === 'check_in') {
        // Arrival defaults to now. Correcting it is done on the appointment
        // page, which can show the scheduled time beside it for context.
        const result = await checkInAppointment(appointment.id)
        onChanged(result.appointment)
      } else {
        onChanged(
          await updateAppointmentStatus(
            appointment.id,
            key === 'complete' ? 'completed' : 'no_show',
          ),
        )
      }
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
            key={action.key}
            tone={action.tone ?? 'secondary'}
            disabled={busy !== null}
            onClick={() => run(action.key)}
            className={compact ? 'px-2.5 py-1.5 text-xs' : ''}
          >
            {busy === action.key ? '…' : action.label}
          </ActionButton>
        ))}
        <ActionButton
          tone="ghost"
          onClick={() => navigate(`/clinic/appointments/${appointment.id}`)}
          className={compact ? 'px-2 py-1.5 text-xs' : ''}
          title="Open appointment for reschedule, cancel and history"
        >
          Manage
        </ActionButton>
      </div>
      {error && <span className="max-w-xs text-right text-xs text-(--color-danger)">{error}</span>}
    </div>
  )
}
