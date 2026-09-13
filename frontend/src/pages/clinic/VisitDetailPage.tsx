import { CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  completeVisit,
  createPrescription,
  createTreatment,
  createVisit,
  deleteTreatment,
  getVisit,
  startVisitFromAppointment,
  updateVisit,
} from '../../api/clinical'
import { getPatient } from '../../api/patients'
import { PatientAlerts } from '../../components/clinic/PatientAlerts'
import { PatientPicker } from '../../components/clinic/PatientPicker'
import {
  ActionButton,
  Card,
  CardTitle,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  Pill,
  Select,
  Spinner,
  TextArea,
  TextInput,
} from '../../components/clinic/ui'
import { getPatientSummary } from '../../api/patients'
import { formatDateShort, todayIso } from '../../lib/format'
import type { ClinicalVisit, PatientListRow, PrescriptionItem } from '../../types/clinic'

const EMPTY_ITEM: PrescriptionItem = {
  medication_name: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
}

/**
 * The chairside record.
 *
 * Handles both "start a new visit" and "open an existing one" because the
 * workflow is continuous: the dentist starts the visit and keeps typing into
 * the same screen until they sign it off. Notes save explicitly rather than on
 * every keystroke — a clinician mid-sentence should not be racing the network.
 */
export function VisitDetailPage({ mode }: { mode: 'new' | 'view' }) {
  const navigate = useNavigate()
  const { visitId } = useParams()
  const [searchParams] = useSearchParams()

  const [visit, setVisit] = useState<ClinicalVisit | null>(null)
  const [patientPick, setPatientPick] = useState<PatientListRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const [alerts, setAlerts] = useState<{ allergies: never[]; conditions: never[] } | null>(null)
  const [treatmentOpen, setTreatmentOpen] = useState(false)
  const [prescriptionOpen, setPrescriptionOpen] = useState(false)

  const appointmentParam = searchParams.get('appointment')
  const patientParam = searchParams.get('patient')

  const loadVisit = useCallback(
    (uuid: string) =>
      getVisit(uuid)
        .then(setVisit)
        .catch((err: unknown) =>
          setError(err instanceof ApiError ? err.message : 'Could not load this visit.'),
        ),
    [],
  )

  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        if (mode === 'view' && visitId) {
          await loadVisit(visitId)
        } else if (appointmentParam) {
          // Straight from a checked-in appointment: the server returns the
          // existing visit if one was already started.
          const started = await startVisitFromAppointment(Number(appointmentParam))
          if (!cancelled) {
            setVisit(started)
            navigate(`/clinic/visits/${started.uuid}`, { replace: true })
          }
        } else if (patientParam) {
          const patient = await getPatient(patientParam)
          if (!cancelled) {
            setPatientPick({
              uuid: patient.uuid,
              patient_code: patient.patient_code,
              full_name: patient.full_name,
              first_name: patient.first_name,
              last_name: patient.last_name,
              phone: patient.phone,
              email: patient.email,
              date_of_birth: patient.date_of_birth,
              age: patient.age,
              gender: patient.gender,
              is_active: patient.is_active,
              last_visit_date: null,
              next_appointment_date: null,
              created_at: patient.created_at,
            })
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not start this visit.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [mode, visitId, appointmentParam, patientParam, loadVisit, navigate])

  // The allergy banner must be visible while treatment is being recorded.
  useEffect(() => {
    const uuid = visit?.patient
    if (!uuid) return
    getPatientSummary(uuid)
      .then((summary) =>
        setAlerts({
          allergies: summary.alerts.allergies as never[],
          conditions: summary.alerts.conditions as never[],
        }),
      )
      .catch(() => setAlerts(null))
  }, [visit?.patient])

  async function startBlankVisit() {
    if (!patientPick) return
    setSaving(true)
    try {
      const created = await createVisit({
        patient: patientPick.uuid,
        visit_date: todayIso(),
      })
      navigate(`/clinic/visits/${created.uuid}`, { replace: true })
      setVisit(created)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start this visit.')
    } finally {
      setSaving(false)
    }
  }

  async function saveField(patch: Partial<ClinicalVisit>) {
    if (!visit) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateVisit(visit.uuid, patch)
      setVisit(updated)
      setSavedAt(new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these notes.')
    } finally {
      setSaving(false)
    }
  }

  async function signOff() {
    if (!visit) return
    setSaving(true)
    try {
      const completed = await completeVisit(visit.uuid, true)
      setVisit(completed)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete this visit.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Opening visit…" />

  // New visit with no patient chosen yet.
  if (!visit) {
    return (
      <>
        <PageHeader title="New Clinical Visit" subtitle="Choose the patient being seen." />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Card className="max-w-xl">
          <Field label="Patient" required>
            <PatientPicker value={patientPick} onSelect={setPatientPick} />
          </Field>
          <div className="mt-4 flex gap-2">
            <ActionButton tone="primary" onClick={startBlankVisit} disabled={!patientPick || saving}>
              {saving ? 'Starting…' : 'Start Visit'}
            </ActionButton>
            <ActionButton onClick={() => navigate(-1)}>Cancel</ActionButton>
          </div>
        </Card>
      </>
    )
  }

  const readOnly = visit.status === 'completed'

  return (
    <>
      <PageHeader
        title="Clinical Visit"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {visit.patient_detail && (
              <Link
                to={`/clinic/patients/${visit.patient}`}
                className="font-medium text-(--color-accent) hover:underline"
              >
                {visit.patient_detail.full_name} ({visit.patient_detail.patient_code})
              </Link>
            )}
            <span>{formatDateShort(visit.visit_date)}</span>
            <Pill tone={readOnly ? 'accent' : 'warning'}>{visit.status_display}</Pill>
            {savedAt && !readOnly && (
              <span className="text-xs text-(--color-ink-faint)">Saved {savedAt}</span>
            )}
          </span>
        }
        actions={
          !readOnly && (
            <ActionButton tone="primary" onClick={signOff} disabled={saving}>
              <CheckCircle2 className="h-4 w-4" /> Complete Visit
            </ActionButton>
          )
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {alerts && (
        <div className="mb-5">
          <PatientAlerts allergies={alerts.allergies} conditions={alerts.conditions} />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="flex flex-col gap-5 xl:col-span-2">
          <Card>
            <CardTitle>Encounter</CardTitle>
            <div className="flex flex-col gap-4">
              <NoteField
                label="Chief Complaint"
                value={visit.chief_complaint}
                readOnly={readOnly}
                onSave={(value) => saveField({ chief_complaint: value })}
              />
              <NoteField
                label="History of Present Illness"
                value={visit.history_of_present_illness}
                readOnly={readOnly}
                onSave={(value) => saveField({ history_of_present_illness: value })}
              />
              <NoteField
                label="Clinical Examination"
                value={visit.clinical_examination}
                readOnly={readOnly}
                onSave={(value) => saveField({ clinical_examination: value })}
              />
              <NoteField
                label="Diagnosis"
                value={visit.diagnosis}
                readOnly={readOnly}
                onSave={(value) => saveField({ diagnosis: value })}
              />
              <NoteField
                label="Treatment Performed"
                value={visit.treatment_performed}
                readOnly={readOnly}
                onSave={(value) => saveField({ treatment_performed: value })}
              />
              <NoteField
                label="Clinical Notes"
                value={visit.clinical_notes}
                readOnly={readOnly}
                onSave={(value) => saveField({ clinical_notes: value })}
              />
            </div>
          </Card>

          <Card>
            <CardTitle>Follow-up</CardTitle>
            <div className="flex flex-col gap-4">
              <NoteField
                label="Follow-up Instructions"
                value={visit.follow_up_instructions}
                readOnly={readOnly}
                onSave={(value) => saveField({ follow_up_instructions: value })}
              />
              <NoteField
                label="Next Visit Recommendation"
                value={visit.next_visit_recommendation}
                readOnly={readOnly}
                onSave={(value) => saveField({ next_visit_recommendation: value })}
              />
              <Field label="Next Visit Date">
                <TextInput
                  type="date"
                  disabled={readOnly}
                  value={visit.next_visit_date ?? ''}
                  onChange={(e) => saveField({ next_visit_date: e.target.value || null })}
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardTitle
              actions={
                !readOnly && (
                  <ActionButton
                    className="px-2.5 py-1.5 text-xs"
                    onClick={() => setTreatmentOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </ActionButton>
                )
              }
            >
              Treatments
            </CardTitle>
            {visit.treatments.length === 0 ? (
              <p className="text-sm text-(--color-ink-soft)">None recorded for this visit.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {visit.treatments.map((treatment) => (
                  <li
                    key={treatment.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-(--color-border) px-3 py-2"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-(--color-ink)">{treatment.name}</p>
                      <p className="text-xs text-(--color-ink-soft)">
                        {[
                          treatment.tooth_number && `Tooth ${treatment.tooth_number}`,
                          treatment.status_display,
                          treatment.cost && `₹${treatment.cost}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {!readOnly && (
                      <button
                        aria-label="Remove treatment"
                        onClick={async () => {
                          await deleteTreatment(treatment.id)
                          loadVisit(visit.uuid)
                        }}
                        className="shrink-0 rounded p-1 text-(--color-ink-faint) hover:bg-red-50 hover:text-(--color-danger)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle
              actions={
                !readOnly && (
                  <ActionButton
                    className="px-2.5 py-1.5 text-xs"
                    onClick={() => setPrescriptionOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </ActionButton>
                )
              }
            >
              Prescriptions
            </CardTitle>
            {visit.prescriptions.length === 0 ? (
              <p className="text-sm text-(--color-ink-soft)">None issued at this visit.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {visit.prescriptions.map((prescription) => (
                  <li key={prescription.uuid} className="rounded-lg border border-(--color-border) px-3 py-2">
                    <p className="text-xs text-(--color-ink-faint)">
                      {formatDateShort(prescription.prescribed_date)}
                    </p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {prescription.items.map((item, index) => (
                        <li key={item.id ?? index} className="text-sm">
                          <span className="font-medium text-(--color-ink)">
                            {item.medication_name}
                          </span>{' '}
                          <span className="text-(--color-ink-soft)">
                            {[item.dosage, item.frequency, item.duration]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <TreatmentModal
        open={treatmentOpen}
        onClose={() => setTreatmentOpen(false)}
        onSaved={() => {
          setTreatmentOpen(false)
          loadVisit(visit.uuid)
        }}
        patientUuid={visit.patient}
        visitUuid={visit.uuid}
        visitDate={visit.visit_date}
      />

      <PrescriptionModal
        open={prescriptionOpen}
        onClose={() => setPrescriptionOpen(false)}
        onSaved={() => {
          setPrescriptionOpen(false)
          loadVisit(visit.uuid)
        }}
        patientUuid={visit.patient}
        visitUuid={visit.uuid}
        visitDate={visit.visit_date}
      />
    </>
  )
}

/** Textarea that commits on blur. Autosaving per keystroke would fire a
 * request mid-word; saving only on leaving the field matches how notes are
 * actually typed. */
function NoteField({
  label,
  value,
  readOnly,
  onSave,
}: {
  label: string
  value: string
  readOnly: boolean
  onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)
  // Adjusting state during render (React's documented pattern) rather than in
  // an effect: the draft follows the saved value without an extra render pass.
  if (value !== syncedValue) {
    setSyncedValue(value)
    setDraft(value)
  }
  return (
    <Field label={label}>
      <TextArea
        value={draft}
        disabled={readOnly}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onSave(draft)
        }}
      />
    </Field>
  )
}

function TreatmentModal({
  open,
  onClose,
  onSaved,
  patientUuid,
  visitUuid,
  visitDate,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  patientUuid: string
  visitUuid: string
  visitDate: string
}) {
  const [form, setForm] = useState({
    name: '',
    tooth_number: '',
    surfaces: '',
    status: 'completed',
    cost: '',
    notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await createTreatment({
        patient: patientUuid,
        visit: visitUuid,
        name: form.name,
        tooth_number: form.tooth_number,
        surfaces: form.surfaces,
        status: form.status as never,
        performed_date: visitDate,
        cost: form.cost || null,
        notes: form.notes,
      })
      setForm({ name: '', tooth_number: '', surfaces: '', status: 'completed', cost: '', notes: '' })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this treatment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title="Add Treatment" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Treatment" required>
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Composite filling"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tooth" hint="FDI, e.g. 36">
            <TextInput
              value={form.tooth_number}
              onChange={(e) => setForm({ ...form, tooth_number: e.target.value })}
            />
          </Field>
          <Field label="Surfaces" hint="e.g. MOD">
            <TextInput
              value={form.surfaces}
              onChange={(e) => setForm({ ...form, surfaces: e.target.value })}
            />
          </Field>
          <Field label="Cost">
            <TextInput
              type="number"
              step="0.01"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="planned">Planned</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </Select>
        </Field>
        <Field label="Notes">
          <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="primary" onClick={save} disabled={!form.name || busy}>
            {busy ? 'Saving…' : 'Add Treatment'}
          </ActionButton>
        </div>
      </div>
    </Modal>
  )
}

function PrescriptionModal({
  open,
  onClose,
  onSaved,
  patientUuid,
  visitUuid,
  visitDate,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  patientUuid: string
  visitUuid: string
  visitDate: string
}) {
  const [items, setItems] = useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setItem(index: number, patch: Partial<PrescriptionItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await createPrescription({
        patient: patientUuid,
        visit: visitUuid,
        prescribed_date: visitDate,
        notes,
        items: items.filter((item) => item.medication_name.trim()),
      })
      setItems([{ ...EMPTY_ITEM }])
      setNotes('')
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this prescription.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title="New Prescription" onClose={onClose} width="max-w-2xl">
      <div className="flex flex-col gap-4">
        {items.map((item, index) => (
          <div key={index} className="rounded-lg border border-(--color-border) p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Medication" required className="sm:col-span-2">
                <TextInput
                  value={item.medication_name}
                  onChange={(e) => setItem(index, { medication_name: e.target.value })}
                  placeholder="e.g. Amoxicillin 500mg"
                />
              </Field>
              <Field label="Dosage">
                <TextInput
                  value={item.dosage}
                  onChange={(e) => setItem(index, { dosage: e.target.value })}
                />
              </Field>
              <Field label="Frequency">
                <TextInput
                  value={item.frequency}
                  onChange={(e) => setItem(index, { frequency: e.target.value })}
                  placeholder="e.g. 3 times daily"
                />
              </Field>
              <Field label="Duration">
                <TextInput
                  value={item.duration}
                  onChange={(e) => setItem(index, { duration: e.target.value })}
                  placeholder="e.g. 5 days"
                />
              </Field>
              <Field label="Instructions">
                <TextInput
                  value={item.instructions}
                  onChange={(e) => setItem(index, { instructions: e.target.value })}
                  placeholder="e.g. After food"
                />
              </Field>
            </div>
            {items.length > 1 && (
              <button
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                className="mt-2 text-xs font-medium text-(--color-danger) hover:underline"
              >
                Remove this medication
              </button>
            )}
          </div>
        ))}

        <ActionButton onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}>
          <Plus className="h-3.5 w-3.5" /> Add another medication
        </ActionButton>

        <Field label="Notes">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex justify-end gap-2">
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton
            tone="primary"
            onClick={save}
            disabled={busy || !items.some((item) => item.medication_name.trim())}
          >
            {busy ? 'Saving…' : 'Issue Prescription'}
          </ActionButton>
        </div>
      </div>
    </Modal>
  )
}
