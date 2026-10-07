import { Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { listAuditLogs } from '../../api/staff'
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
import { formatDateTime } from '../../lib/format'
import type { AuditLogEntry } from '../../types/clinic'

const ACTIONS = [
  { value: '', label: 'All actions' },
  { value: 'view', label: 'Viewed' },
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' },
  { value: 'merge', label: 'Merged' },
  { value: 'login', label: 'Signed in' },
  { value: 'login_failed', label: 'Failed sign-in' },
]

function toneFor(action: string) {
  if (action === 'delete' || action === 'login_failed') return 'danger' as const
  if (action === 'create' || action === 'merge') return 'accent' as const
  if (action === 'update') return 'warning' as const
  return 'neutral' as const
}

/**
 * The access trail.
 *
 * Read-only by construction — entries cannot be written or edited through the
 * API. Reads are recorded alongside writes, because "who opened this patient's
 * file" is the question that matters after the fact.
 */
export function AuditPage() {
  const [action, setAction] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AuditLogEntry[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listAuditLogs({ page, action: action || undefined, search: search.trim() || undefined })
      .then((data) => {
        setRows(data.results)
        setCount(data.count)
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load the audit trail.'),
      )
      .finally(() => setLoading(false))
  }, [page, action, search])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const totalPages = Math.max(1, Math.ceil(count / 25))

  return (
    <>
      <PageHeader
        title="Audit Trail"
        subtitle={`${count} recorded action${count === 1 ? '' : 's'}. Entries cannot be edited or deleted.`}
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
              placeholder="Record or username…"
              className="pl-9"
            />
          </div>
          <Select
            value={action}
            onChange={(e) => {
              setAction(e.target.value)
              setPage(1)
            }}
          >
            {ACTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card padded={false}>
        {loading && <Spinner />}
        {!loading && rows.length === 0 && <EmptyState title="No matching audit entries" />}
        {!loading && rows.length > 0 && (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Record</Th>
                <Th>Patient</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <Td className="whitespace-nowrap text-(--color-ink-soft)">
                    {formatDateTime(entry.timestamp)}
                  </Td>
                  <Td className="font-medium">{entry.username || '—'}</Td>
                  <Td>
                    <Pill tone={toneFor(entry.action)}>{entry.action_display}</Pill>
                  </Td>
                  <Td>
                    <span className="text-xs text-(--color-ink-faint)">{entry.model_name}</span>
                    <div className="max-w-[240px] truncate">{entry.object_repr || '—'}</div>
                  </Td>
                  <Td className="whitespace-nowrap text-(--color-ink-soft)">
                    {entry.patient_code ?? '—'}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-(--color-ink-faint)">
                    {entry.ip_address ?? '—'}
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
