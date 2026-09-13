import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPrescriptions } from '../../api/clinical'
import {
  Card,
  CardTitle,
  EmptyState,
  ErrorNote,
  PageHeader,
  Spinner,
  TextInput,
} from '../../components/clinic/ui'
import { ApiError } from '../../api/client'
import { formatDateShort } from '../../lib/format'
import type { Prescription } from '../../types/clinic'

export function PrescriptionsPage() {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      setError(null)
      listPrescriptions({ search: search.trim() || undefined })
        .then(setRows)
        .catch((err: unknown) =>
          setError(err instanceof ApiError ? err.message : 'Could not load prescriptions.'),
        )
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <>
      <PageHeader
        title="Prescriptions"
        subtitle="Issued from a clinical visit. Search by patient or medication."
      />

      <Card className="mb-5">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-ink-faint)" />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Patient name, patient ID or medication…"
            className="pl-9"
          />
        </div>
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && <Spinner />}

      {!loading && rows.length === 0 && (
        <Card>
          <EmptyState
            title="No prescriptions found"
            hint="Prescriptions are issued from within a clinical visit."
          />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((prescription) => (
          <Card key={prescription.uuid}>
            <CardTitle
              actions={
                <span className="text-sm text-(--color-ink-soft)">
                  {formatDateShort(prescription.prescribed_date)}
                </span>
              }
            >
              {prescription.patient_detail ? (
                <Link
                  to={`/clinic/patients/${prescription.patient_detail.uuid}`}
                  className="hover:text-(--color-accent) hover:underline"
                >
                  {prescription.patient_detail.full_name}
                </Link>
              ) : (
                'Prescription'
              )}
            </CardTitle>
            <p className="mb-2 text-xs text-(--color-ink-faint)">
              {prescription.patient_detail?.patient_code}
              {prescription.prescribed_by_name ? ` · ${prescription.prescribed_by_name}` : ''}
            </p>
            <ul className="flex flex-col gap-1.5">
              {prescription.items.map((item, index) => (
                <li key={item.id ?? index} className="text-sm">
                  <span className="font-medium text-(--color-ink)">{item.medication_name}</span>{' '}
                  <span className="text-(--color-ink-soft)">
                    {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
                    {item.instructions ? ` — ${item.instructions}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            {prescription.notes && (
              <p className="mt-3 border-t border-(--color-border) pt-3 text-sm text-(--color-ink-soft)">
                {prescription.notes}
              </p>
            )}
          </Card>
        ))}
      </div>
    </>
  )
}
