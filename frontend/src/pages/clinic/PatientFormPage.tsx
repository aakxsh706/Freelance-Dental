import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, fieldErrors } from '../../api/client'
import { createPatient, getPatient, updatePatient } from '../../api/patients'
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
import type { PatientInput } from '../../types/clinic'

const GENDERS = [
  { value: '', label: 'Not recorded' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'undisclosed', label: 'Prefer not to say' },
]

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']

const EMPTY: PatientInput = {
  first_name: '',
  last_name: '',
  phone: '',
  alternate_phone: '',
  email: '',
  date_of_birth: null,
  gender: '',
  blood_group: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'India',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
  occupation: '',
  preferred_language: '',
  notes: '',
}

/**
 * Add / edit a patient.
 *
 * Only the first name is required. Intake happens over several visits and a
 * partially filled record is normal, so the form must never block saving what
 * the clinic actually knows today.
 */
export function PatientFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const navigate = useNavigate()
  const { patientId } = useParams()
  const [form, setForm] = useState<PatientInput>(EMPTY)
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (mode !== 'edit' || !patientId) return
    getPatient(patientId)
      .then((patient) => setForm({ ...patient }))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load this patient.'),
      )
      .finally(() => setLoading(false))
  }, [mode, patientId])

  function set<K extends keyof PatientInput>(key: K, value: PatientInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setErrors({})
    try {
      // Blank date inputs come through as "" but the API expects null.
      const payload = { ...form, date_of_birth: form.date_of_birth || null }
      const saved =
        mode === 'edit' && patientId
          ? await updatePatient(patientId, payload)
          : await createPatient(payload)
      navigate(`/clinic/patients/${saved.uuid}`)
    } catch (err) {
      setErrors(fieldErrors(err))
      setError(err instanceof ApiError ? err.message : 'Could not save this patient.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Loading patient…" />

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        title={mode === 'edit' ? 'Edit Patient' : 'New Patient'}
        subtitle={
          mode === 'edit'
            ? 'The patient ID cannot be changed — it appears on existing paperwork.'
            : 'A patient ID is assigned automatically. Only a first name is required.'
        }
        actions={
          <>
            <ActionButton type="button" onClick={() => navigate(-1)}>
              Cancel
            </ActionButton>
            <ActionButton tone="primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Create Patient'}
            </ActionButton>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Identity</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First Name" required error={errors.first_name}>
              <TextInput
                value={form.first_name ?? ''}
                onChange={(e) => set('first_name', e.target.value)}
                required
              />
            </Field>
            <Field label="Last Name" error={errors.last_name}>
              <TextInput
                value={form.last_name ?? ''}
                onChange={(e) => set('last_name', e.target.value)}
              />
            </Field>
            <Field label="Date of Birth" error={errors.date_of_birth}>
              <TextInput
                type="date"
                value={form.date_of_birth ?? ''}
                onChange={(e) => set('date_of_birth', e.target.value || null)}
              />
            </Field>
            <Field label="Gender">
              <Select value={form.gender ?? ''} onChange={(e) => set('gender', e.target.value as PatientInput['gender'])}>
                {GENDERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Blood Group">
              <Select
                value={form.blood_group ?? ''}
                onChange={(e) => set('blood_group', e.target.value)}
              >
                {BLOOD_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {group === '' ? 'Not recorded' : group === 'unknown' ? 'Unknown' : group}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Occupation">
              <TextInput
                value={form.occupation ?? ''}
                onChange={(e) => set('occupation', e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Contact</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Phone"
              error={errors.phone}
              hint="Used to recognise this patient when they book on the website."
            >
              <TextInput value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Alternate Phone">
              <TextInput
                value={form.alternate_phone ?? ''}
                onChange={(e) => set('alternate_phone', e.target.value)}
              />
            </Field>
            <Field label="Email" error={errors.email} className="sm:col-span-2">
              <TextInput
                type="email"
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Preferred Language">
              <TextInput
                value={form.preferred_language ?? ''}
                onChange={(e) => set('preferred_language', e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Address</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address Line 1" className="sm:col-span-2">
              <TextInput
                value={form.address_line_1 ?? ''}
                onChange={(e) => set('address_line_1', e.target.value)}
              />
            </Field>
            <Field label="Address Line 2" className="sm:col-span-2">
              <TextInput
                value={form.address_line_2 ?? ''}
                onChange={(e) => set('address_line_2', e.target.value)}
              />
            </Field>
            <Field label="City">
              <TextInput value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field label="State">
              <TextInput value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} />
            </Field>
            <Field label="Postal Code">
              <TextInput
                value={form.postal_code ?? ''}
                onChange={(e) => set('postal_code', e.target.value)}
              />
            </Field>
            <Field label="Country">
              <TextInput
                value={form.country ?? ''}
                onChange={(e) => set('country', e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Emergency Contact</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <TextInput
                value={form.emergency_contact_name ?? ''}
                onChange={(e) => set('emergency_contact_name', e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <TextInput
                value={form.emergency_contact_phone ?? ''}
                onChange={(e) => set('emergency_contact_phone', e.target.value)}
              />
            </Field>
            <Field label="Relationship" className="sm:col-span-2">
              <TextInput
                value={form.emergency_contact_relationship ?? ''}
                onChange={(e) => set('emergency_contact_relationship', e.target.value)}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Notes" hint="Administrative notes. Clinical findings belong in a visit.">
              <TextArea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </div>
        </Card>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <ActionButton type="button" onClick={() => navigate(-1)}>
          Cancel
        </ActionButton>
        <ActionButton tone="primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Create Patient'}
        </ActionButton>
      </div>
    </form>
  )
}
