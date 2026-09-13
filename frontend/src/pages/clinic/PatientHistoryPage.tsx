import { Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  allergiesApi,
  conditionsApi,
  familyHistoryApi,
  getPatientHistory,
  hospitalizationsApi,
  medicationsApi,
  surgeriesApi,
  updateDentalHistory,
  updateMedicalProfile,
} from '../../api/patients'
import {
  ActionButton,
  Card,
  CardTitle,
  ErrorNote,
  Field,
  PageHeader,
  Select,
  Spinner,
  TextArea,
  TextInput,
} from '../../components/clinic/ui'
import type { PatientHistory } from '../../types/clinic'

/**
 * Structured medical and dental history.
 *
 * Each category is its own list of records rather than one free-text field, so
 * "is this patient allergic to penicillin" is a query the system can answer
 * instead of something a clinician has to read a paragraph to find out.
 */
export function PatientHistoryPage() {
  const { patientId } = useParams()
  const [history, setHistory] = useState<PatientHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    if (!patientId) return
    getPatientHistory(patientId)
      .then(setHistory)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load this history.'),
      )
      .finally(() => setLoading(false))
  }, [patientId])

  useEffect(reload, [reload])

  if (loading) return <Spinner label="Loading history…" />
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!history || !patientId) return null

  return (
    <>
      <PageHeader
        title="Medical &amp; Dental History"
        subtitle="Nothing here is mandatory — intake usually happens over several visits."
        actions={
          <Link
            to={`/clinic/patients/${patientId}`}
            className="rounded-lg border border-(--color-border) px-3 py-2 text-sm font-medium text-(--color-ink) hover:border-(--color-accent)/50"
          >
            Back to patient
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <RecordList
          title="Allergies"
          records={history.allergies}
          onAdd={(values) =>
            allergiesApi.create({
              patient: patientId,
              substance: values.substance,
              reaction: values.reaction,
              severity: (values.severity || 'moderate') as never,
            })
          }
          onDelete={(id) => allergiesApi.remove(id)}
          onChanged={reload}
          render={(record) => (
            <>
              <span className="font-medium text-(--color-ink)">{record.substance}</span>
              <span className="text-(--color-ink-soft)">
                {' '}
                — {record.severity_display}
                {record.reaction ? ` · ${record.reaction}` : ''}
              </span>
            </>
          )}
          fields={[
            { name: 'substance', label: 'Substance', required: true },
            { name: 'reaction', label: 'Reaction' },
            {
              name: 'severity',
              label: 'Severity',
              options: [
                { value: 'mild', label: 'Mild' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'severe', label: 'Severe' },
                { value: 'life_threatening', label: 'Life-threatening' },
              ],
            },
          ]}
        />

        <RecordList
          title="Medical Conditions"
          records={history.conditions}
          onAdd={(values) =>
            conditionsApi.create({
              patient: patientId,
              condition: values.condition,
              diagnosed_date: values.diagnosed_date || null,
              status: (values.status || 'active') as never,
            })
          }
          onDelete={(id) => conditionsApi.remove(id)}
          onChanged={reload}
          render={(record) => (
            <>
              <span className="font-medium text-(--color-ink)">{record.condition}</span>
              <span className="text-(--color-ink-soft)"> — {record.status_display}</span>
            </>
          )}
          fields={[
            { name: 'condition', label: 'Condition', required: true },
            { name: 'diagnosed_date', label: 'Diagnosed', type: 'date' },
            {
              name: 'status',
              label: 'Status',
              options: [
                { value: 'active', label: 'Active' },
                { value: 'managed', label: 'Managed' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'unknown', label: 'Not recorded' },
              ],
            },
          ]}
        />

        <RecordList
          title="Current Medications"
          records={history.medications}
          onAdd={(values) =>
            medicationsApi.create({
              patient: patientId,
              medication_name: values.medication_name,
              dosage: values.dosage,
              frequency: values.frequency,
            })
          }
          onDelete={(id) => medicationsApi.remove(id)}
          onChanged={reload}
          render={(record) => (
            <>
              <span className="font-medium text-(--color-ink)">{record.medication_name}</span>
              <span className="text-(--color-ink-soft)">
                {' '}
                {[record.dosage, record.frequency].filter(Boolean).join(' · ')}
              </span>
            </>
          )}
          fields={[
            { name: 'medication_name', label: 'Medication', required: true },
            { name: 'dosage', label: 'Dosage' },
            { name: 'frequency', label: 'Frequency' },
          ]}
        />

        <RecordList
          title="Past Surgeries"
          records={history.surgeries}
          onAdd={(values) =>
            surgeriesApi.create({
              patient: patientId,
              procedure: values.procedure,
              surgery_date: values.surgery_date || null,
              hospital: values.hospital,
            })
          }
          onDelete={(id) => surgeriesApi.remove(id)}
          onChanged={reload}
          render={(record) => (
            <>
              <span className="font-medium text-(--color-ink)">{record.procedure}</span>
              <span className="text-(--color-ink-soft)">
                {record.surgery_date ? ` — ${record.surgery_date}` : ''}
                {record.hospital ? ` · ${record.hospital}` : ''}
              </span>
            </>
          )}
          fields={[
            { name: 'procedure', label: 'Procedure', required: true },
            { name: 'surgery_date', label: 'Date', type: 'date' },
            { name: 'hospital', label: 'Hospital' },
          ]}
        />

        <RecordList
          title="Hospitalizations"
          records={history.hospitalizations}
          onAdd={(values) =>
            hospitalizationsApi.create({
              patient: patientId,
              reason: values.reason,
              admitted_date: values.admitted_date || null,
              hospital: values.hospital,
            })
          }
          onDelete={(id) => hospitalizationsApi.remove(id)}
          onChanged={reload}
          render={(record) => (
            <>
              <span className="font-medium text-(--color-ink)">{record.reason}</span>
              <span className="text-(--color-ink-soft)">
                {record.admitted_date ? ` — ${record.admitted_date}` : ''}
              </span>
            </>
          )}
          fields={[
            { name: 'reason', label: 'Reason', required: true },
            { name: 'admitted_date', label: 'Admitted', type: 'date' },
            { name: 'hospital', label: 'Hospital' },
          ]}
        />

        <RecordList
          title="Family History"
          records={history.family_history}
          onAdd={(values) =>
            familyHistoryApi.create({
              patient: patientId,
              relationship: values.relationship,
              condition: values.condition,
            })
          }
          onDelete={(id) => familyHistoryApi.remove(id)}
          onChanged={reload}
          render={(record) => (
            <>
              <span className="font-medium text-(--color-ink)">{record.relationship}</span>
              <span className="text-(--color-ink-soft)"> — {record.condition}</span>
            </>
          )}
          fields={[
            { name: 'relationship', label: 'Relationship', required: true },
            { name: 'condition', label: 'Condition', required: true },
          ]}
        />
      </div>

      <LifestyleCard patientId={patientId} history={history} onSaved={reload} />
      <DentalHistoryCard patientId={patientId} history={history} onSaved={reload} />
    </>
  )
}

interface FieldSpec {
  name: string
  label: string
  required?: boolean
  type?: string
  options?: { value: string; label: string }[]
}

/** Add/remove list shared by every history category. Editing an entry is
 * delete-and-re-add: these are short records, and an in-place editor for six
 * different shapes would be far more code than it earns. */
function RecordList<T extends { id: number }>({
  title,
  records,
  fields,
  render,
  onAdd,
  onDelete,
  onChanged,
}: {
  title: string
  records: T[]
  fields: FieldSpec[]
  render: (record: T) => ReactNode
  onAdd: (values: Record<string, string>) => Promise<unknown>
  onDelete: (id: number) => Promise<unknown>
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await onAdd(values)
      setValues({})
      setAdding(false)
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save that.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    await onDelete(id)
    onChanged()
  }

  return (
    <Card>
      <CardTitle
        actions={
          <ActionButton className="px-2.5 py-1.5 text-xs" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Add
          </ActionButton>
        }
      >
        {title}
      </CardTitle>

      {records.length === 0 && !adding && (
        <p className="text-sm text-(--color-ink-soft)">Nothing recorded.</p>
      )}

      <ul className="flex flex-col gap-2">
        {records.map((record) => (
          <li
            key={record.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-(--color-border) px-3 py-2 text-sm"
          >
            <span className="min-w-0">{render(record)}</span>
            <button
              onClick={() => remove(record.id)}
              aria-label="Remove"
              className="shrink-0 rounded p-1 text-(--color-ink-faint) hover:bg-red-50 hover:text-(--color-danger)"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {adding && (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-(--color-border) bg-(--color-surface) p-3">
          {fields.map((spec) => (
            <Field key={spec.name} label={spec.label} required={spec.required}>
              {spec.options ? (
                <Select
                  value={values[spec.name] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [spec.name]: e.target.value }))}
                >
                  {spec.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <TextInput
                  type={spec.type ?? 'text'}
                  value={values[spec.name] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [spec.name]: e.target.value }))}
                />
              )}
            </Field>
          ))}
          {error && <p className="text-xs text-(--color-danger)">{error}</p>}
          <div className="flex gap-2">
            <ActionButton tone="primary" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </ActionButton>
            <ActionButton onClick={() => setAdding(false)}>Cancel</ActionButton>
          </div>
        </div>
      )}
    </Card>
  )
}

function LifestyleCard({
  patientId,
  history,
  onSaved,
}: {
  patientId: string
  history: PatientHistory
  onSaved: () => void
}) {
  const [form, setForm] = useState(history.medical_profile)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    await updateMedicalProfile(patientId, {
      smoking_status: form.smoking_status,
      alcohol_use: form.alcohol_use,
      pregnancy_status: form.pregnancy_status,
      other_notes: form.other_notes,
    })
    setBusy(false)
    onSaved()
  }

  return (
    <Card className="mt-5">
      <CardTitle
        actions={
          <ActionButton tone="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </ActionButton>
        }
      >
        General Health
      </CardTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Smoking">
          <Select
            value={form.smoking_status}
            onChange={(e) => setForm({ ...form, smoking_status: e.target.value })}
          >
            <option value="unknown">Not recorded</option>
            <option value="never">Never smoked</option>
            <option value="former">Former smoker</option>
            <option value="current">Current smoker</option>
          </Select>
        </Field>
        <Field label="Alcohol">
          <Select
            value={form.alcohol_use}
            onChange={(e) => setForm({ ...form, alcohol_use: e.target.value })}
          >
            <option value="unknown">Not recorded</option>
            <option value="never">Never</option>
            <option value="occasional">Occasional</option>
            <option value="regular">Regular</option>
            <option value="former">Former</option>
          </Select>
        </Field>
        <Field label="Pregnancy">
          <Select
            value={form.pregnancy_status}
            onChange={(e) => setForm({ ...form, pregnancy_status: e.target.value })}
          >
            <option value="not_applicable">Not applicable</option>
            <option value="not_pregnant">Not pregnant</option>
            <option value="pregnant">Pregnant</option>
            <option value="breastfeeding">Breastfeeding</option>
            <option value="unknown">Not recorded</option>
          </Select>
        </Field>
        <Field label="Other Notes" className="sm:col-span-3">
          <TextArea
            value={form.other_notes}
            onChange={(e) => setForm({ ...form, other_notes: e.target.value })}
          />
        </Field>
      </div>
    </Card>
  )
}

function DentalHistoryCard({
  patientId,
  history,
  onSaved,
}: {
  patientId: string
  history: PatientHistory
  onSaved: () => void
}) {
  const [form, setForm] = useState(history.dental_history)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    await updateDentalHistory(patientId, {
      previous_treatments: form.previous_treatments,
      last_dental_visit: form.last_dental_visit || null,
      oral_hygiene: form.oral_hygiene,
      brushing_frequency: form.brushing_frequency,
      flosses: form.flosses,
      tooth_sensitivity: form.tooth_sensitivity,
      tooth_sensitivity_notes: form.tooth_sensitivity_notes,
      bleeding_gums: form.bleeding_gums,
      gum_disease: form.gum_disease,
      bruxism: form.bruxism,
      orthodontic_history: form.orthodontic_history,
      has_implants: form.has_implants,
      has_crowns: form.has_crowns,
      has_bridges: form.has_bridges,
      has_dentures: form.has_dentures,
      root_canal_history: form.root_canal_history,
      extractions: form.extractions,
      dental_material_reactions: form.dental_material_reactions,
      notes: form.notes,
    })
    setBusy(false)
    onSaved()
  }

  /** Three-state: yes / no / not recorded. "Not asked yet" is a real and
   * common answer during intake and must not collapse into "no". */
  function triState(key: keyof typeof form, label: string) {
    const value = form[key] as boolean | null
    return (
      <Field key={String(key)} label={label}>
        <Select
          value={value === null || value === undefined ? '' : value ? 'yes' : 'no'}
          onChange={(e) =>
            setForm({
              ...form,
              [key]: e.target.value === '' ? null : e.target.value === 'yes',
            })
          }
        >
          <option value="">Not recorded</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </Select>
      </Field>
    )
  }

  return (
    <Card className="mt-5">
      <CardTitle
        actions={
          <ActionButton tone="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </ActionButton>
        }
      >
        Dental History
      </CardTitle>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Oral Hygiene">
          <Select
            value={form.oral_hygiene}
            onChange={(e) => setForm({ ...form, oral_hygiene: e.target.value })}
          >
            <option value="unknown">Not recorded</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </Select>
        </Field>
        <Field label="Brushing">
          <Select
            value={form.brushing_frequency}
            onChange={(e) => setForm({ ...form, brushing_frequency: e.target.value })}
          >
            <option value="unknown">Not recorded</option>
            <option value="twice_daily">Twice daily</option>
            <option value="once_daily">Once daily</option>
            <option value="irregular">Irregular</option>
          </Select>
        </Field>
        <Field label="Last Dental Visit">
          <TextInput
            type="date"
            value={form.last_dental_visit ?? ''}
            onChange={(e) => setForm({ ...form, last_dental_visit: e.target.value || null })}
          />
        </Field>
        {triState('flosses', 'Flosses')}
        {triState('tooth_sensitivity', 'Tooth Sensitivity')}
        {triState('bleeding_gums', 'Bleeding Gums')}
        {triState('gum_disease', 'Gum Disease')}
        {triState('bruxism', 'Bruxism / Grinding')}
        {triState('orthodontic_history', 'Orthodontic History')}
        {triState('has_implants', 'Implants')}
        {triState('has_crowns', 'Crowns')}
        {triState('has_bridges', 'Bridges')}
        {triState('has_dentures', 'Dentures')}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Root Canal History">
          <TextArea
            value={form.root_canal_history}
            onChange={(e) => setForm({ ...form, root_canal_history: e.target.value })}
          />
        </Field>
        <Field label="Extractions">
          <TextArea
            value={form.extractions}
            onChange={(e) => setForm({ ...form, extractions: e.target.value })}
          />
        </Field>
        <Field
          label="Dental Material Reactions"
          hint="Latex, anaesthetic, metals and similar."
        >
          <TextArea
            value={form.dental_material_reactions}
            onChange={(e) => setForm({ ...form, dental_material_reactions: e.target.value })}
          />
        </Field>
        <Field label="Previous Treatments">
          <TextArea
            value={form.previous_treatments}
            onChange={(e) => setForm({ ...form, previous_treatments: e.target.value })}
          />
        </Field>
      </div>
    </Card>
  )
}
