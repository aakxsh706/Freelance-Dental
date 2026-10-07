import { CalendarOff, Clock, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import {
  createBlockedDate,
  createWorkingHours,
  deleteBlockedDate,
  deleteWorkingHours,
  listBlockedDates,
  listWorkingHours,
} from '../../api/availability'
import { ApiError } from '../../api/client'
import { getClinicSettings, updateClinicSettings } from '../../api/clinic'
import {
  ActionButton,
  Card,
  CardTitle,
  EmptyState,
  ErrorNote,
  Field,
  PageHeader,
  Select,
  Spinner,
  TextInput,
} from '../../components/clinic/ui'
import { useAuthStore } from '../../stores/authStore'
import { formatDateShort, formatTime12h, todayIso } from '../../lib/format'
import type { BlockedDate, ClinicSettings, DentistAvailability } from '../../types'

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const TABS = [
  { to: '/clinic/settings', label: 'Clinic Details', end: true },
  { to: '/clinic/settings/availability', label: 'Working Hours' },
  { to: '/clinic/settings/blocked-dates', label: 'Holidays' },
]

export function SettingsPage() {
  const canManage = useAuthStore((state) => state.staff?.can_manage_settings ?? false)

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="These values drive the public website and the booking calendar."
      />

      {!canManage && (
        <div className="mb-5">
          <ErrorNote>
            Your role can view these settings but not change them. Ask a dentist or administrator to
            make changes.
          </ErrorNote>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-1 border-b border-(--color-border)">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-(--color-accent) text-(--color-accent)'
                  : 'border-transparent text-(--color-ink-soft) hover:text-(--color-ink)'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Routes>
        <Route index element={<ClinicDetailsTab canManage={canManage} />} />
        <Route path="availability" element={<WorkingHoursTab canManage={canManage} />} />
        <Route path="blocked-dates" element={<BlockedDatesTab canManage={canManage} />} />
      </Routes>
    </>
  )
}

function ClinicDetailsTab({ canManage }: { canManage: boolean }) {
  const [form, setForm] = useState<ClinicSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getClinicSettings()
      .then(setForm)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load clinic settings.'),
      )
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    if (!form) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateClinicSettings(form)
      setForm(updated)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />
  if (!form) return <ErrorNote>{error ?? 'Clinic settings are unavailable.'}</ErrorNote>

  return (
    <Card className="max-w-3xl">
      <CardTitle
        actions={
          canManage && (
            <ActionButton tone="primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </ActionButton>
          )
        }
      >
        Clinic Details
      </CardTitle>

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {saved && (
        <p className="mb-4 rounded-lg border border-(--color-accent)/30 bg-(--color-accent-soft) px-4 py-2.5 text-sm text-(--color-accent)">
          Saved. The public website now shows these details.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Clinic Name" required className="sm:col-span-2">
          <TextInput
            disabled={!canManage}
            value={form.clinic_name}
            onChange={(e) => setForm({ ...form, clinic_name: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <TextInput
            disabled={!canManage}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <TextInput
            disabled={!canManage}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <TextInput
            disabled={!canManage}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <Field label="Google Maps Embed URL" className="sm:col-span-2">
          <TextInput
            disabled={!canManage}
            value={form.google_maps_embed_url}
            onChange={(e) => setForm({ ...form, google_maps_embed_url: e.target.value })}
          />
        </Field>
        <Field label="Google Maps Link" className="sm:col-span-2">
          <TextInput
            disabled={!canManage}
            value={form.google_maps_url}
            onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })}
          />
        </Field>
        <Field
          label="Appointment Slot Length"
          hint="Minutes. Changing this changes the slots offered on the website."
        >
          <TextInput
            type="number"
            min={5}
            step={5}
            disabled={!canManage}
            value={form.slot_duration_minutes}
            onChange={(e) =>
              setForm({ ...form, slot_duration_minutes: Number(e.target.value) || 30 })
            }
          />
        </Field>
      </div>
    </Card>
  )
}

function WorkingHoursTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<DentistAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ day_of_week: '0', start_time: '09:00', end_time: '13:00' })

  const load = useCallback(() => {
    listWorkingHours()
      .then(setRows)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load working hours.'),
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  async function add() {
    setError(null)
    try {
      await createWorkingHours({
        day_of_week: Number(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
      })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that window.')
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardTitle>Recurring Working Hours</CardTitle>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="No working hours set"
            hint="Without these, the website shows no available slots at all."
          />
        ) : (
          <ul className="divide-y divide-(--color-border)">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-(--color-ink-faint)" strokeWidth={1.75} />
                  <div>
                    <p className="text-sm font-medium text-(--color-ink)">
                      {row.day_of_week_display}
                    </p>
                    <p className="text-xs text-(--color-ink-soft)">
                      {formatTime12h(row.start_time.slice(0, 5))} –{' '}
                      {formatTime12h(row.end_time.slice(0, 5))}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <button
                    aria-label="Remove"
                    onClick={async () => {
                      await deleteWorkingHours(row.id)
                      load()
                    }}
                    className="rounded p-1.5 text-(--color-ink-faint) hover:bg-red-50 hover:text-(--color-danger)"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canManage && (
        <Card>
          <CardTitle>Add a Window</CardTitle>
          <p className="mb-4 text-sm text-(--color-ink-soft)">
            Add two windows for the same day to express a split shift, for example 09:00–13:00 and
            16:00–20:00.
          </p>
          {error && (
            <div className="mb-4">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Day">
              <Select
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
              >
                {DAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="From">
              <TextInput
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </Field>
            <Field label="To">
              <TextInput
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4">
            <ActionButton tone="primary" onClick={add}>
              <Plus className="h-4 w-4" /> Add Window
            </ActionButton>
          </div>
        </Card>
      )}
    </div>
  )
}

function BlockedDatesTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<BlockedDate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ date: todayIso(), reason: '' })

  const load = useCallback(() => {
    listBlockedDates()
      .then(setRows)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load holidays.'),
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  async function add() {
    setError(null)
    try {
      await createBlockedDate({ date: form.date, reason: form.reason })
      setForm({ date: todayIso(), reason: '' })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not block that date.')
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardTitle>Blocked Dates</CardTitle>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No blocked dates" hint="Add holidays and leave so nobody can book them." />
        ) : (
          <ul className="divide-y divide-(--color-border)">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <CalendarOff className="h-4 w-4 text-(--color-ink-faint)" strokeWidth={1.75} />
                  <div>
                    <p className="text-sm font-medium text-(--color-ink)">
                      {formatDateShort(row.date)}
                    </p>
                    {row.reason && (
                      <p className="text-xs text-(--color-ink-soft)">{row.reason}</p>
                    )}
                  </div>
                </div>
                {canManage && (
                  <button
                    aria-label="Remove"
                    onClick={async () => {
                      await deleteBlockedDate(row.id)
                      load()
                    }}
                    className="rounded p-1.5 text-(--color-ink-faint) hover:bg-red-50 hover:text-(--color-danger)"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canManage && (
        <Card>
          <CardTitle>Block a Date</CardTitle>
          {error && (
            <div className="mb-4">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" required>
              <TextInput
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Reason">
              <TextInput
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="e.g. Public holiday"
              />
            </Field>
          </div>
          <div className="mt-4">
            <ActionButton tone="primary" onClick={add}>
              <Plus className="h-4 w-4" /> Block Date
            </ActionButton>
          </div>
        </Card>
      )}
    </div>
  )
}
