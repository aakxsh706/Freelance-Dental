import { Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { listPatients } from '../../api/patients'
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
import type { PatientListRow } from '../../types/clinic'

const PAGE_SIZE = 25

const SORT_OPTIONS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: '-created', label: 'Newest first' },
  { value: 'code', label: 'Patient ID' },
  { value: '-last_visit', label: 'Recently seen' },
  { value: 'next_appointment', label: 'Next appointment' },
]

export function PatientsPage() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name')
  const [activeFilter, setActiveFilter] = useState('')
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState<PatientListRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    // §14: the search runs in the database. The browser never holds the whole
    // patient list, so this stays fast as the clinic grows.
    listPatients({
      page,
      page_size: PAGE_SIZE,
      search: search.trim() || undefined,
      sort,
      is_active: activeFilter || undefined,
    })
      .then((data) => {
        setRows(data.results)
        setCount(data.count)
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load the patient directory.'),
      )
      .finally(() => setLoading(false))
  }, [page, search, sort, activeFilter])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={`${count} patient${count === 1 ? '' : 's'} on file.`}
        actions={
          <Link
            to="/clinic/patients/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-(--color-accent) px-3 py-2 text-sm font-medium text-white hover:bg-(--color-accent-hover)"
          >
            <Plus className="h-4 w-4" /> Add Patient
          </Link>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-ink-faint)" />
            <TextInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Name, patient ID, phone or email…"
              className="pl-9"
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              setPage(1)
            }}
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value)
              setPage(1)
            }}
            aria-label="Filter by status"
          >
            <option value="">All patients</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </Select>
        </div>
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card padded={false}>
        {loading && <Spinner label="Searching patients…" />}
        {!loading && rows.length === 0 && (
          <EmptyState
            title={search ? 'No patients match that search' : 'No patients yet'}
            hint={
              search
                ? 'Try a phone number or patient ID instead.'
                : 'Patients are created automatically when someone books on the website, or you can add one here.'
            }
            action={
              !search ? (
                <Link
                  to="/clinic/patients/new"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-(--color-accent) px-3 py-2 text-sm font-medium text-white hover:bg-(--color-accent-hover)"
                >
                  <Plus className="h-4 w-4" /> Add Patient
                </Link>
              ) : undefined
            }
          />
        )}

        {!loading && rows.length > 0 && (
          <TableWrap>
            <thead>
              <tr>
                <Th>Patient ID</Th>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Age</Th>
                <Th>Last Visit</Th>
                <Th>Next Appointment</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((patient) => (
                <tr key={patient.uuid} className="hover:bg-(--color-surface)/60">
                  <Td>
                    <Link
                      to={`/clinic/patients/${patient.uuid}`}
                      className="font-mono text-xs font-medium text-(--color-accent) hover:underline"
                    >
                      {patient.patient_code}
                    </Link>
                  </Td>
                  <Td>
                    <Link
                      to={`/clinic/patients/${patient.uuid}`}
                      className="font-medium hover:text-(--color-accent) hover:underline"
                    >
                      {patient.full_name}
                    </Link>
                    {patient.email && (
                      <div className="text-xs text-(--color-ink-soft)">{patient.email}</div>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{patient.phone || '—'}</Td>
                  <Td>{patient.age ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-(--color-ink-soft)">
                    {formatDateShort(patient.last_visit_date)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {patient.next_appointment_date ? (
                      <span className="text-(--color-accent)">
                        {formatDateShort(patient.next_appointment_date)}
                      </span>
                    ) : (
                      <span className="text-(--color-ink-faint)">—</span>
                    )}
                  </Td>
                  <Td>
                    {patient.is_active ? (
                      <Pill tone="accent">Active</Pill>
                    ) : (
                      <Pill>Inactive</Pill>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-(--color-border) px-4 py-3">
            <span className="text-sm text-(--color-ink-soft)">
              Page {page} of {totalPages} · {count} patients
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
