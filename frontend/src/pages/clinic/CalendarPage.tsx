import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCalendar } from '../../api/appointments'
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorNote,
  PageHeader,
  Spinner,
} from '../../components/clinic/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useFetch } from '../../hooks/useFetch'
import { addDaysIso, formatDateLong, formatTimeOfDay, startOfWeekIso, todayIso } from '../../lib/format'
import type { Appointment } from '../../types'

type View = 'day' | 'week' | 'month'

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

function daysInMonth(iso: string): number {
  const [year, month] = iso.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

/** The date range a view covers. The server caps ranges at 62 days, which a
 * month view stays comfortably inside. */
function rangeFor(view: View, anchor: string): { start: string; end: string } {
  if (view === 'day') return { start: anchor, end: anchor }
  if (view === 'week') {
    const start = startOfWeekIso(anchor)
    return { start, end: addDaysIso(start, 6) }
  }
  const start = monthStart(anchor)
  return { start, end: addDaysIso(start, daysInMonth(anchor) - 1) }
}

export function CalendarPage() {
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(todayIso())

  const { start, end } = useMemo(() => rangeFor(view, anchor), [view, anchor])
  const { data, loading, error } = useFetch(() => getCalendar(start, end), [start, end])

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const appointment of data?.appointments ?? []) {
      const list = map.get(appointment.appointment_date) ?? []
      list.push(appointment)
      map.set(appointment.appointment_date, list)
    }
    return map
  }, [data])

  const days = useMemo(() => {
    const result: string[] = []
    let cursor = start
    while (cursor <= end) {
      result.push(cursor)
      cursor = addDaysIso(cursor, 1)
    }
    return result
  }, [start, end])

  function shift(direction: number) {
    if (view === 'day') return setAnchor(addDaysIso(anchor, direction))
    if (view === 'week') return setAnchor(addDaysIso(anchor, direction * 7))
    const [year, month] = anchor.split('-').map(Number)
    const next = new Date(year, month - 1 + direction, 1)
    setAnchor(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`,
    )
  }

  const rangeLabel =
    view === 'day'
      ? formatDateLong(anchor)
      : view === 'month'
        ? new Date(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1, 1).toLocaleDateString(
            'en-IN',
            { month: 'long', year: 'numeric' },
          )
        : `${formatDateLong(start)} — ${formatDateLong(end)}`

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={rangeLabel}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-(--color-border) p-0.5">
              {(['day', 'week', 'month'] as View[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setView(option)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    view === option
                      ? 'bg-(--color-accent) text-white'
                      : 'text-(--color-ink-soft) hover:text-(--color-ink)'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <ActionButton onClick={() => shift(-1)} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </ActionButton>
            <ActionButton onClick={() => setAnchor(todayIso())}>Today</ActionButton>
            <ActionButton onClick={() => shift(1)} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </ActionButton>
          </div>
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && <Spinner label="Loading schedule…" />}

      {!loading && data && (
        <div
          className={
            view === 'month'
              ? 'grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7'
              : view === 'week'
                ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-7'
                : 'grid gap-3'
          }
        >
          {days.map((day) => {
            const appointments = byDate.get(day) ?? []
            const isToday = day === todayIso()
            return (
              <Card
                key={day}
                padded={false}
                className={isToday ? 'border-(--color-accent)/50' : ''}
              >
                <div
                  className={`border-b border-(--color-border) px-3 py-2 ${
                    isToday ? 'bg-(--color-accent-soft)' : ''
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-(--color-ink-faint)">
                    {new Date(
                      Number(day.slice(0, 4)),
                      Number(day.slice(5, 7)) - 1,
                      Number(day.slice(8, 10)),
                    ).toLocaleDateString('en-IN', { weekday: 'short' })}
                  </p>
                  <p className="font-display text-sm font-semibold text-(--color-ink)">
                    {day.slice(8, 10)}{' '}
                    <span className="text-xs font-normal text-(--color-ink-soft)">
                      {appointments.length > 0 && `· ${appointments.length}`}
                    </span>
                  </p>
                </div>

                {appointments.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-(--color-ink-faint)">
                    No appointments
                  </p>
                ) : (
                  <ul className="divide-y divide-(--color-border)">
                    {appointments.map((appointment) => (
                      <li key={appointment.id} className="px-3 py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold text-(--color-ink)">
                            {formatTimeOfDay(appointment.appointment_time)}
                          </span>
                          <StatusBadge status={appointment.status} />
                        </div>
                        {appointment.patient ? (
                          <Link
                            to={`/clinic/patients/${appointment.patient.uuid}`}
                            className="mt-0.5 block truncate text-sm text-(--color-ink) hover:text-(--color-accent) hover:underline"
                          >
                            {appointment.patient_name}
                          </Link>
                        ) : (
                          <span className="mt-0.5 block truncate text-sm text-(--color-ink)">
                            {appointment.patient_name}
                          </span>
                        )}
                        <p className="truncate text-xs text-(--color-ink-soft)">
                          {appointment.reason}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {!loading && data && data.appointments.length === 0 && (
        <Card className="mt-4">
          <EmptyState title="Nothing scheduled in this range" />
        </Card>
      )}
    </>
  )
}
