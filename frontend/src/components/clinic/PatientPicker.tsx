import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { listPatients } from '../../api/patients'
import type { PatientListRow } from '../../types/clinic'
import { TextInput } from './ui'

/**
 * Type-to-search patient selector.
 *
 * Queries the server on a short debounce rather than filtering a preloaded
 * list - the directory is paginated precisely so it is never all in the
 * browser at once.
 */
export function PatientPicker({
  value,
  onSelect,
  placeholder = 'Search by name, patient ID or phone…',
}: {
  value: PatientListRow | null
  onSelect: (patient: PatientListRow | null) => void
  placeholder?: string
}) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<PatientListRow[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const query = term.trim()
  const searching = query.length >= 2
  // Derived rather than cleared in the effect, so a stale list can never flash
  // while the box is being emptied.
  const visibleResults = searching ? results : []

  useEffect(() => {
    if (!searching) return
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      listPatients({ search: query, page_size: 8 })
        .then((page) => {
          if (!cancelled) setResults(page.results)
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, searching])

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-(--color-accent)/30 bg-(--color-accent-soft) px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-(--color-ink)">{value.full_name}</p>
          <p className="text-xs text-(--color-ink-soft)">
            {value.patient_code}
            {value.phone ? ` · ${value.phone}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null)
            setTerm('')
          }}
          className="shrink-0 text-xs font-medium text-(--color-accent) hover:underline"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-ink-faint)" />
        <TextInput
          value={term}
          placeholder={placeholder}
          onChange={(e) => {
            setTerm(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="pl-9"
        />
      </div>
      {open && searching && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-bg) shadow-lg">
          {loading && <p className="px-3 py-2 text-sm text-(--color-ink-soft)">Searching…</p>}
          {!loading && visibleResults.length === 0 && (
            <p className="px-3 py-2 text-sm text-(--color-ink-soft)">No matching patient.</p>
          )}
          {visibleResults.map((patient) => (
            <button
              key={patient.uuid}
              type="button"
              onClick={() => {
                onSelect(patient)
                setOpen(false)
              }}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-(--color-surface)"
            >
              <span className="text-sm font-medium text-(--color-ink)">{patient.full_name}</span>
              <span className="text-xs text-(--color-ink-soft)">
                {patient.patient_code}
                {patient.phone ? ` · ${patient.phone}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
