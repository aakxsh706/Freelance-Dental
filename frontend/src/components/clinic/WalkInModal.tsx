import { AlertTriangle, Search, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { registerWalkIn, searchWalkInPatients } from '../../api/appointments'
import { ApiError } from '../../api/client'
import type { AppointmentActionResult } from '../../types'
import type { PatientListRow } from '../../types/clinic'
import { ActionButton, ErrorNote, Field, Modal, TextArea, TextInput } from './ui'

/**
 * Registering someone who arrived without an appointment.
 *
 * Search first, create second - and only if the search genuinely finds
 * nobody. That order is the entire defence against duplicate patients: a
 * receptionist who is handed a "create patient" form first will use it, and
 * the clinic ends up with three John Mathews. If they do create, any patient
 * already holding the phone number or email is surfaced as a warning before
 * the record is made, and the decision stays theirs - nothing is auto-merged
 * on a similar name.
 */
interface WalkInModalProps {
  open: boolean
  onClose: () => void
  onDone: (result: AppointmentActionResult) => void
}

/** Unmounted while closed, so a second walk-in never inherits the first one's
 * half-filled form. */
export function WalkInModal(props: WalkInModalProps) {
  if (!props.open) return null
  return <WalkInModalBody {...props} />
}

/** Arrival defaults to now, in the local format the datetime input expects. */
function nowForInput(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function WalkInModalBody({ open, onClose, onDone }: WalkInModalProps) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<PatientListRow[]>([])
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<PatientListRow | null>(null)
  const [creating, setCreating] = useState(false)

  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '' })
  const [duplicates, setDuplicates] = useState<PatientListRow[]>([])
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [arrivedAt, setArrivedAt] = useState(nowForInput)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const query = term.trim()
  const searching = query.length >= 2
  // Derived rather than cleared inside the effect, so an old result list can
  // never flash while the box is being retyped.
  const visibleResults = searching ? results : []

  useEffect(() => {
    if (!searching) return
    let cancelled = false
    const timer = setTimeout(() => {
      searchWalkInPatients({ search: query })
        .then((data) => {
          if (!cancelled) {
            setResults(data.results)
            setSearched(true)
          }
        })
        .catch(() => undefined)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, searching])

  // Duplicate check while the new-patient form is being filled in: is this
  // phone or email already on somebody's record?
  const dupeKey = creating ? `${form.phone.trim()}|${form.email.trim()}` : ''
  const checkingDupes = dupeKey.length > 1
  const visibleDuplicates = checkingDupes ? duplicates : []

  useEffect(() => {
    if (!checkingDupes) return
    let cancelled = false
    const [phone, email] = dupeKey.split('|')
    const timer = setTimeout(() => {
      searchWalkInPatients({ phone, email })
        .then((data) => {
          if (!cancelled) setDuplicates(data.likely_existing)
        })
        .catch(() => undefined)
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [dupeKey, checkingDupes])

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const result = await registerWalkIn({
        ...(selected ? { patient: selected.uuid } : form),
        reason,
        notes,
        ...(arrivedAt ? { arrived_at: new Date(arrivedAt).toISOString() } : {}),
      })
      onDone(result)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register this walk-in.')
    } finally {
      setSaving(false)
    }
  }

  const readyToSubmit =
    reason.trim().length > 0 && (selected !== null || form.first_name.trim().length > 0)

  return (
    <Modal open={open} title="Register Walk-In" onClose={onClose} width="max-w-xl">
      <div className="flex flex-col gap-4">
        {!selected && !creating && (
          <>
            <Field label="Search Patient" hint="Name, patient ID, phone or email.">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-ink-faint)" />
                <TextInput
                  autoFocus
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="pl-9"
                />
              </div>
            </Field>

            {visibleResults.length > 0 && (
              <div className="flex flex-col gap-2">
                {visibleResults.map((patient) => (
                  <button
                    key={patient.uuid}
                    onClick={() => setSelected(patient)}
                    className="flex items-center justify-between gap-3 rounded-lg border border-(--color-border) px-3 py-2 text-left hover:border-(--color-accent)/50 hover:bg-(--color-accent-soft)"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-(--color-ink)">
                        {patient.full_name}
                      </span>
                      <span className="block text-xs text-(--color-ink-soft)">
                        {patient.patient_code}
                        {patient.phone ? ` · ${patient.phone}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-(--color-accent)">
                      Select
                    </span>
                  </button>
                ))}
              </div>
            )}

            {searched && searching && visibleResults.length === 0 && (
              <p className="text-sm text-(--color-ink-soft)">No patient found.</p>
            )}

            <ActionButton onClick={() => setCreating(true)}>
              <UserPlus className="h-4 w-4" /> Create New Patient
            </ActionButton>
          </>
        )}

        {selected && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-(--color-accent)/30 bg-(--color-accent-soft) px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-(--color-ink)">
                {selected.full_name}
              </p>
              <p className="text-xs text-(--color-ink-soft)">
                {selected.patient_code}
                {selected.phone ? ` · ${selected.phone}` : ''}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="shrink-0 text-xs font-medium text-(--color-accent) hover:underline"
            >
              Change
            </button>
          </div>
        )}

        {creating && !selected && (
          <div className="rounded-lg border border-(--color-border) p-3">
            <p className="mb-3 text-sm font-medium text-(--color-ink)">New Patient</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First Name" required>
                <TextInput
                  autoFocus
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </Field>
              <Field label="Last Name">
                <TextInput
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <TextInput
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <TextInput
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
            </div>

            {visibleDuplicates.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                <p className="flex items-center gap-2 text-sm font-medium text-(--color-ink)">
                  <AlertTriangle className="h-4 w-4 text-amber-700" strokeWidth={2} />
                  Someone already has these contact details
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {visibleDuplicates.map((patient) => (
                    <button
                      key={patient.uuid}
                      onClick={() => {
                        setSelected(patient)
                        setCreating(false)
                      }}
                      className="flex items-center justify-between gap-3 rounded border border-amber-200 bg-white px-3 py-1.5 text-left text-sm hover:border-(--color-accent)/50"
                    >
                      <span>
                        {patient.full_name}{' '}
                        <span className="text-(--color-ink-soft)">{patient.patient_code}</span>
                      </span>
                      <span className="text-xs font-medium text-(--color-accent)">Use this one</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-(--color-ink-soft)">
                  Continue below only if this is genuinely a different person.
                </p>
              </div>
            )}

            <button
              onClick={() => setCreating(false)}
              className="mt-3 text-sm font-medium text-(--color-accent) hover:underline"
            >
              ← Back to search
            </button>
          </div>
        )}

        {(selected || creating) && (
          <>
            <Field label="Reason for Visit" required>
              <TextInput
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Severe tooth pain"
              />
            </Field>
            <Field label="Arrival Time" hint="Defaults to now. Correct it if they arrived earlier.">
              <TextInput
                type="datetime-local"
                value={arrivedAt}
                onChange={(e) => setArrivedAt(e.target.value)}
              />
            </Field>
            <Field label="Notes">
              <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </Field>
            <p className="text-xs text-(--color-ink-faint)">
              The patient will be recorded as checked in, with a walk-in source.
            </p>
          </>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex justify-end gap-2">
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="primary" disabled={!readyToSubmit || saving} onClick={submit}>
            {saving ? 'Registering…' : 'Register Walk-In'}
          </ActionButton>
        </div>
      </div>
    </Modal>
  )
}
