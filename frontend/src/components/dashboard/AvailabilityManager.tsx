import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  createBlockedDate,
  createWorkingHours,
  deleteBlockedDate,
  deleteWorkingHours,
  listBlockedDates,
  listWorkingHours,
} from '../../api/availability'
import { ApiError } from '../../api/client'
import { useFetch } from '../../hooks/useFetch'
import { todayIso } from '../../lib/format'
import { Button } from '../ui/Button'

const WEEKDAYS = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
]

function WorkingHoursPanel() {
  const { data, loading, error, reload } = useFetch(listWorkingHours, [])
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('13:00')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleAdd() {
    setFormError(null)
    setSubmitting(true)
    try {
      await createWorkingHours({ day_of_week: dayOfWeek, start_time: startTime, end_time: endTime })
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not add this working block.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    await deleteWorkingHours(id)
    reload()
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-(--color-border) bg-(--color-bg) p-6">
      <h3 className="text-sm font-semibold text-(--color-ink)">Working Hours</h3>
      <p className="text-xs text-(--color-ink-faint)">
        Sample values only — add or remove working-hour blocks per day (e.g. a morning and
        evening shift).
      </p>

      {loading && <div className="h-24 animate-pulse rounded-lg bg-(--color-surface)" />}
      {error && <p className="text-sm text-(--color-danger)">Could not load working hours.</p>}

      {data && (
        <ul className="flex flex-col divide-y divide-(--color-border)">
          {data.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-(--color-ink)">
                {row.day_of_week_display}: {row.start_time.slice(0, 5)} – {row.end_time.slice(0, 5)}
              </span>
              <button
                onClick={() => handleDelete(row.id)}
                aria-label="Remove this working-hour block"
                className="text-(--color-ink-faint) hover:text-(--color-danger)"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </li>
          ))}
          {data.length === 0 && (
            <li className="py-2 text-sm text-(--color-ink-soft)">No working hours configured.</li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-(--color-border) pt-4">
        <label className="flex flex-col gap-1 text-xs text-(--color-ink-faint)">
          Day
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className="rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
          >
            {WEEKDAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-(--color-ink-faint)">
          Start
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-(--color-ink-faint)">
          End
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
          />
        </label>
        <Button variant="secondary" onClick={handleAdd} disabled={submitting} className="!py-2">
          Add Block
        </Button>
      </div>
      {formError && <p className="text-xs text-(--color-danger)">{formError}</p>}
    </div>
  )
}

function BlockedDatesPanel() {
  const { data, loading, error, reload } = useFetch(listBlockedDates, [])
  const [date, setDate] = useState(todayIso())
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleAdd() {
    setFormError(null)
    setSubmitting(true)
    try {
      await createBlockedDate({ date, reason })
      setReason('')
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not add this date.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    await deleteBlockedDate(id)
    reload()
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-(--color-border) bg-(--color-bg) p-6">
      <h3 className="text-sm font-semibold text-(--color-ink)">Holidays &amp; Unavailable Dates</h3>

      {loading && <div className="h-16 animate-pulse rounded-lg bg-(--color-surface)" />}
      {error && <p className="text-sm text-(--color-danger)">Could not load blocked dates.</p>}

      {data && (
        <ul className="flex flex-col divide-y divide-(--color-border)">
          {data.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-(--color-ink)">
                {row.date}
                {row.reason ? ` — ${row.reason}` : ''}
              </span>
              <button
                onClick={() => handleDelete(row.id)}
                aria-label="Remove this blocked date"
                className="text-(--color-ink-faint) hover:text-(--color-danger)"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </li>
          ))}
          {data.length === 0 && (
            <li className="py-2 text-sm text-(--color-ink-soft)">No blocked dates configured.</li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-(--color-border) pt-4">
        <label className="flex flex-col gap-1 text-xs text-(--color-ink-faint)">
          Date
          <input
            type="date"
            min={todayIso()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-(--color-ink-faint)">
          Reason (optional)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Public holiday"
            className="rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm"
          />
        </label>
        <Button variant="secondary" onClick={handleAdd} disabled={submitting} className="!py-2">
          Add Date
        </Button>
      </div>
      {formError && <p className="text-xs text-(--color-danger)">{formError}</p>}
    </div>
  )
}

export function AvailabilityManager() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <WorkingHoursPanel />
      <BlockedDatesPanel />
    </div>
  )
}
