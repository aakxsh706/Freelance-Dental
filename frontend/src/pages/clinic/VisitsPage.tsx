import { Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { listVisitsPaged } from '../../api/clinical'
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorNote,
  PageHeader,
  Pill,
  Select,
  Spinner,
  TableWrap,
  Td,
  TextInput,
  Th,
} from '../../components/clinic/ui'
import { formatDateShort } from '../../lib/format'
import type { ClinicalVisitRow } from '../../types/clinic'

export function VisitsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<ClinicalVisitRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listVisitsPaged({ page, search: search.trim() || undefined, status: status || undefined })
      .then((data) => {
        setRows(data.results)
        setCount(data.count)
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load clinical records.'),
      )
      .finally(() => setLoading(false))
  }, [page, search, status])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const totalPages = Math.max(1, Math.ceil(count / 25))

  return (
    <>
      <PageHeader
        title="Clinical Records"
        subtitle={`${count} recorded visit${count === 1 ? '' : 's'}. A visit is what happened, not what was scheduled.`}
        actions={
          <Link
            to="/clinic/visits/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-(--color-accent) px-3 py-2 text-sm font-medium text-white hover:bg-(--color-accent-hover)"
          >
            <Plus className="h-4 w-4" /> New Visit
          </Link>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-ink-faint)" />
            <TextInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Patient, complaint or diagnosis…"
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
            <option value="">All visits</option>
            <option value="draft">In progress</option>
            <option value="completed">Completed</option>
          </Select>
        </div>
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card padded={false}>
        {loading && <Spinner />}
        {!loading && rows.length === 0 && (
          <EmptyState
            title="No clinical visits yet"
            hint="Visits are usually started from a checked-in appointment on the dashboard."
          />
        )}
        {!loading && rows.length > 0 && (
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Patient</Th>
                <Th>Chief Complaint</Th>
                <Th>Diagnosis</Th>
                <Th>Treatments</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((visit) => (
                <tr key={visit.uuid} className="hover:bg-(--color-surface)/60">
                  <Td className="whitespace-nowrap">
                    <Link
                      to={`/clinic/visits/${visit.uuid}`}
                      className="font-medium text-(--color-accent) hover:underline"
                    >
                      {formatDateShort(visit.visit_date)}
                    </Link>
                  </Td>
                  <Td>
                    {visit.patient_detail ? (
                      <Link
                        to={`/clinic/patients/${visit.patient_detail.uuid}`}
                        className="font-medium hover:text-(--color-accent) hover:underline"
                      >
                        {visit.patient_detail.full_name}
                      </Link>
                    ) : (
                      '—'
                    )}
                    <div className="text-xs text-(--color-ink-soft)">
                      {visit.patient_detail?.patient_code}
                    </div>
                  </Td>
                  <Td className="max-w-[220px] truncate">{visit.chief_complaint || '—'}</Td>
                  <Td className="max-w-[220px] truncate">{visit.diagnosis || '—'}</Td>
                  <Td>{visit.treatment_count}</Td>
                  <Td>
                    <Pill tone={visit.status === 'completed' ? 'accent' : 'warning'}>
                      {visit.status_display}
                    </Pill>
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
    </>
  )
}
