import { Plus, Search, Stethoscope, UserCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  listAppointmentsNeedingReview,
  listAppointmentsPaged,
  resolveAppointmentPatient,
} from '../../api/appointments'
import { ApiError } from '../../api/client'
import { AppointmentStatusControl } from '../../components/clinic/AppointmentStatusControl'
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorNote,
  Modal,
  PageHeader,
  Pill,
  Select,
  Spinner,
  TableWrap,
  Td,
  TextInput,
  Th,
} from '../../components/clinic/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { formatDateShort, formatTimeOfDay, sourceLabels } from '../../lib/format'
import type { Appointment } from '../../types'
import type { AppointmentNeedingReview } from '../../types/clinic'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
]

export function AppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const needsReviewOnly = searchParams.get('needs_review') === '1'

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState<Appointment[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reviewQueue, setReviewQueue] = useState<AppointmentNeedingReview[]>([])
  const [resolving, setResolving] = useState<AppointmentNeedingReview | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    // Filtering is a server query, not a client-side filter over a full
    // download - appointment history grows without bound.
    listAppointmentsPaged({
      page,
      search: search.trim() || undefined,
      status: status || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      needs_review: needsReviewOnly || undefined,
      ordering: '-date',
    })
      .then((data) => {
        setRows(data.results)
        setCount(data.count)
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load appointments.'),
      )
      .finally(() => setLoading(false))
  }, [page, search, status, dateFrom, dateTo, needsReviewOnly])

  useEffect(() => {
    // Debounced so typing in the search box does not fire a request per key.
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    listAppointmentsNeedingReview().then(setReviewQueue).catch(() => setReviewQueue([]))
  }, [])

  function replaceRow(updated: Appointment) {
    setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
  }

  async function resolve(appointment: AppointmentNeedingReview, payload: { patient?: string; create_new?: boolean }) {
    const updated = await resolveAppointmentPatient(appointment.id, payload)
    replaceRow(updated)
    setReviewQueue((prev) => prev.filter((row) => row.id !== appointment.id))
    setResolving(null)
  }

  const totalPages = Math.max(1, Math.ceil(count / 25))

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={`${count} appointment${count === 1 ? '' : 's'} matching your filters.`}
        actions={
          <Link
            to="/clinic/appointments/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-(--color-accent) px-3 py-2 text-sm font-medium text-white hover:bg-(--color-accent-hover)"
          >
            <Plus className="h-4 w-4" /> New Appointment
          </Link>
        }
      />

      {reviewQueue.length > 0 && !needsReviewOnly && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-(--color-ink)">
            {reviewQueue.length} website booking{reviewQueue.length === 1 ? '' : 's'} need a patient
            record chosen
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {reviewQueue.slice(0, 4).map((appointment) => (
              <ActionButton key={appointment.id} onClick={() => setResolving(appointment)}>
                <UserCheck className="h-3.5 w-3.5" /> {appointment.patient_name}
              </ActionButton>
            ))}
          </div>
        </div>
      )}

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-ink-faint)" />
            <TextInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Name, phone, patient ID…"
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <TextInput
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
            aria-label="From date"
          />
          <TextInput
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
            aria-label="To date"
          />
        </div>
        {needsReviewOnly && (
          <div className="mt-3">
            <button
              onClick={() => {
                searchParams.delete('needs_review')
                setSearchParams(searchParams)
              }}
              className="text-sm font-medium text-(--color-accent) hover:underline"
            >
              Clear &ldquo;needs review&rdquo; filter
            </button>
          </div>
        )}
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card padded={false}>
        {loading && <Spinner />}
        {!loading && rows.length === 0 && (
          <EmptyState
            title="No appointments match these filters"
            hint="Try widening the date range or clearing the status filter."
          />
        )}
        {!loading && rows.length > 0 && (
          <TableWrap>
            <thead>
              <tr>
                <Th>Date &amp; Time</Th>
                <Th>Patient</Th>
                <Th>Reason</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((appointment) => (
                <tr key={appointment.id} className="hover:bg-(--color-surface)/60">
                  <Td>
                    <div className="whitespace-nowrap font-medium">
                      {formatDateShort(appointment.appointment_date)}
                    </div>
                    <div className="text-xs text-(--color-ink-soft)">
                      {formatTimeOfDay(appointment.appointment_time)}
                    </div>
                  </Td>
                  <Td>
                    {appointment.patient ? (
                      <Link
                        to={`/clinic/patients/${appointment.patient.uuid}`}
                        className="font-medium hover:text-(--color-accent) hover:underline"
                      >
                        {appointment.patient_name}
                      </Link>
                    ) : (
                      <span className="font-medium">{appointment.patient_name}</span>
                    )}
                    <div className="text-xs text-(--color-ink-soft)">
                      {appointment.patient?.patient_code ?? appointment.phone}
                    </div>
                  </Td>
                  <Td className="max-w-[220px] truncate">{appointment.reason}</Td>
                  <Td>
                    <span className="text-xs text-(--color-ink-soft)">
                      {sourceLabels[appointment.source] ?? appointment.source}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={appointment.status} />
                      {appointment.needs_patient_review && <Pill tone="warning">Needs review</Pill>}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-2">
                      {appointment.status === 'checked_in' && !appointment.has_visit && (
                        <Link
                          to={`/clinic/visits/new?appointment=${appointment.id}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-(--color-accent)/40 px-2.5 py-1.5 text-xs font-medium text-(--color-accent) hover:bg-(--color-accent-soft)"
                        >
                          <Stethoscope className="h-3.5 w-3.5" /> Start visit
                        </Link>
                      )}
                      {appointment.needs_patient_review && (
                        <ActionButton
                          className="px-2.5 py-1.5 text-xs"
                          onClick={() => {
                            const match = reviewQueue.find((row) => row.id === appointment.id)
                            if (match) setResolving(match)
                          }}
                        >
                          Resolve
                        </ActionButton>
                      )}
                      <AppointmentStatusControl
                        appointment={appointment}
                        compact
                        onChanged={replaceRow}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-(--color-border) px-4 py-3">
            <span className="text-sm text-(--color-ink-soft)">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <ActionButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </ActionButton>
              <ActionButton disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </ActionButton>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={resolving !== null}
        title="Which patient is this?"
        onClose={() => setResolving(null)}
      >
        {resolving && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
              <p className="text-sm font-medium text-(--color-ink)">{resolving.patient_name}</p>
              <p className="text-sm text-(--color-ink-soft)">
                {resolving.phone}
                {resolving.email ? ` · ${resolving.email}` : ''}
              </p>
              <p className="mt-1 text-xs text-(--color-ink-faint)">
                {formatDateShort(resolving.appointment_date)} ·{' '}
                {formatTimeOfDay(resolving.appointment_time)} · {resolving.reason}
              </p>
            </div>

            <p className="text-sm text-(--color-ink-soft)">
              These existing patients share this phone number or email. They were not merged
              automatically because the names differ.
            </p>

            <div className="flex flex-col gap-2">
              {resolving.candidates.map((candidate) => (
                <button
                  key={candidate.uuid}
                  onClick={() => resolve(resolving, { patient: candidate.uuid })}
                  className="flex items-center justify-between gap-3 rounded-lg border border-(--color-border) px-4 py-3 text-left hover:border-(--color-accent)/50 hover:bg-(--color-accent-soft)"
                >
                  <span>
                    <span className="block text-sm font-medium text-(--color-ink)">
                      {candidate.full_name}
                    </span>
                    <span className="block text-xs text-(--color-ink-soft)">
                      {candidate.patient_code}
                      {candidate.phone ? ` · ${candidate.phone}` : ''}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-(--color-accent)">This one</span>
                </button>
              ))}
            </div>

            <ActionButton tone="primary" onClick={() => resolve(resolving, { create_new: true })}>
              None of these — create a new patient record
            </ActionButton>
          </div>
        )}
      </Modal>
    </>
  )
}
