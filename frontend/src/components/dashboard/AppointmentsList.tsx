import { useState } from 'react'
import { listAppointments, updateAppointmentStatus } from '../../api/appointments'
import { ApiError } from '../../api/client'
import { useFetch } from '../../hooks/useFetch'
import { formatDateLong, formatTime12h, todayIso } from '../../lib/format'
import type { Appointment, AppointmentStatus } from '../../types'
import { StatusBadge } from '../ui/StatusBadge'
import { ToothMascot } from '../ui/ToothMascot'

const STATUS_OPTIONS: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'cancelled']

function AppointmentCard({
  appointment,
  onStatusChange,
}: {
  appointment: Appointment
  onStatusChange: (id: number, status: AppointmentStatus) => void
}) {
  const [updating, setUpdating] = useState(false)

  async function handleChange(status: AppointmentStatus) {
    setUpdating(true)
    try {
      await onStatusChange(appointment.id, status)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-(--color-border) bg-(--color-bg) p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold text-(--color-ink)">
            {appointment.patient_name}
          </h3>
          <StatusBadge status={appointment.status} />
        </div>
        <p className="text-sm text-(--color-ink-soft)">
          {formatDateLong(appointment.appointment_date)} &middot;{' '}
          {formatTime12h(appointment.appointment_time.slice(0, 5))}
        </p>
        <p className="text-sm text-(--color-ink)">{appointment.reason}</p>
        <p className="text-xs text-(--color-ink-faint)">
          {appointment.phone}
          {appointment.email ? ` · ${appointment.email}` : ''}
        </p>
        {appointment.notes && (
          <p className="mt-1 rounded-lg bg-(--color-surface) px-3 py-2 text-xs text-(--color-ink-soft)">
            {appointment.notes}
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-(--color-ink-faint) sm:items-end">
        Status
        <select
          value={appointment.status}
          disabled={updating}
          onChange={(e) => handleChange(e.target.value as AppointmentStatus)}
          className="rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-accent)"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
      </label>
    </article>
  )
}

export function AppointmentsList() {
  const [showTodayOnly, setShowTodayOnly] = useState(true)
  const { data, loading, error, reload } = useFetch(
    () => listAppointments(showTodayOnly ? { today: true } : {}),
    [showTodayOnly],
  )
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleStatusChange(id: number, status: AppointmentStatus) {
    setActionError(null)
    try {
      await updateAppointmentStatus(id, status)
      reload()
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'Could not update the appointment status.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-(--color-ink)">
          {showTodayOnly ? `Today's Appointments` : 'All Appointments'}
        </h2>
        <button
          onClick={() => setShowTodayOnly((v) => !v)}
          className="text-sm font-medium text-(--color-accent) hover:underline"
        >
          {showTodayOnly ? 'View all appointments' : `Show today (${todayIso()}) only`}
        </button>
      </div>

      {actionError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-(--color-danger)">
          {actionError}
        </p>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-(--color-bg)" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-(--color-border) bg-(--color-bg) p-6 text-center text-sm text-(--color-ink-soft)">
          Could not load appointments.{' '}
          <button onClick={reload} className="font-medium text-(--color-accent) hover:underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-bg) p-8 text-center">
          <ToothMascot type="happy" size="sm" animated={false} />
          <p className="text-sm font-medium text-(--color-ink)">No appointments</p>
          <p className="text-sm text-(--color-ink-soft)">
            {showTodayOnly
              ? 'There are no appointments scheduled for today.'
              : 'No appointment requests have come in yet.'}
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        data &&
        data.length > 0 &&
        data.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            onStatusChange={handleStatusChange}
          />
        ))}
    </div>
  )
}
