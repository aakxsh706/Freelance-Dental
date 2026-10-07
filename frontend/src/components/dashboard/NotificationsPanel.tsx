import { Bell, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { listAppointments } from '../../api/appointments'
import { useFetch } from '../../hooks/useFetch'
import { formatDateLong, formatTime12h } from '../../lib/format'

export function NotificationsPanel() {
  const { data, loading } = useFetch(() => listAppointments({}), [])
  const [openId, setOpenId] = useState<number | null>(null)

  const pending = (data ?? []).filter((appointment) => appointment.status === 'pending')

  if (loading || pending.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-(--color-accent)/25 bg-(--color-accent-soft) p-5">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-(--color-accent)" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold text-(--color-ink)">
          New Appointment Request{pending.length > 1 ? 's' : ''} ({pending.length})
        </h2>
      </div>

      <div className="flex flex-col divide-y divide-(--color-accent)/15">
        {pending.map((appointment) => {
          const isOpen = openId === appointment.id
          return (
            <div key={appointment.id} className="py-2">
              <button
                onClick={() => setOpenId(isOpen ? null : appointment.id)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <p className="text-sm text-(--color-ink)">
                  New appointment request from <strong>{appointment.patient_name}</strong> for{' '}
                  {formatDateLong(appointment.appointment_date)} at{' '}
                  {formatTime12h(appointment.appointment_time.slice(0, 5))}.
                </p>
                <ChevronDown
                  className={`h-4 w-4 flex-none text-(--color-ink-soft) transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="mt-2 flex flex-col gap-1 rounded-lg bg-(--color-bg) p-3 text-xs text-(--color-ink-soft)">
                  <p>Phone: {appointment.phone}</p>
                  {appointment.email && <p>Email: {appointment.email}</p>}
                  <p>Reason: {appointment.reason}</p>
                  {appointment.notes && <p>Notes: {appointment.notes}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
