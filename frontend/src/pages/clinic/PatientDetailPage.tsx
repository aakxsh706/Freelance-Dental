import { CalendarPlus, FileText, Pencil, Stethoscope } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPatientSummary } from '../../api/patients'
import { PatientAlerts } from '../../components/clinic/PatientAlerts'
import {
  Card,
  CardTitle,
  EmptyState,
  ErrorNote,
  PageHeader,
  Pill,
  Spinner,
  TableWrap,
  Td,
  Th,
} from '../../components/clinic/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuthStore } from '../../stores/authStore'
import { useFetch } from '../../hooks/useFetch'
import { formatDateShort, formatTimeOfDay } from '../../lib/format'

type Tab = 'overview' | 'appointments' | 'visits' | 'treatments' | 'prescriptions'

/**
 * The patient file - the central medical record.
 *
 * Loaded through one `summary` request rather than eight parallel calls, and
 * the alert banner renders above the tabs so allergies are visible whichever
 * tab is open.
 */
export function PatientDetailPage() {
  const { patientId } = useParams()
  const staff = useAuthStore((state) => state.staff)
  const [tab, setTab] = useState<Tab>('overview')
  const { data, loading, error } = useFetch(() => getPatientSummary(patientId!), [patientId])

  if (loading) return <Spinner label="Loading patient record…" />
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return null

  const { patient, alerts, counts } = data
  const canSeeClinical = staff?.can_view_clinical ?? false

  const tabs: { key: Tab; label: string; count?: number; clinical?: boolean }[] = ([
    { key: 'overview', label: 'Overview' },
    { key: 'appointments', label: 'Appointments', count: counts.appointments },
    { key: 'visits', label: 'Visits', count: counts.visits, clinical: true },
    { key: 'treatments', label: 'Treatments', count: counts.treatments, clinical: true },
    { key: 'prescriptions', label: 'Prescriptions', count: counts.prescriptions, clinical: true },
  ] as { key: Tab; label: string; count?: number; clinical?: boolean }[]).filter(
    (item) => !item.clinical || canSeeClinical,
  )

  return (
    <>
      <PageHeader
        title={patient.full_name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs">{patient.patient_code}</span>
            {patient.age !== null && <span>Age {patient.age}</span>}
            {patient.gender_display && <span>{patient.gender_display}</span>}
            {patient.phone && <span>{patient.phone}</span>}
            {patient.email && <span>{patient.email}</span>}
            {!patient.is_active && <Pill>Inactive</Pill>}
            {patient.merged_into_code && (
              <Pill tone="warning">Merged into {patient.merged_into_code}</Pill>
            )}
          </span>
        }
        actions={
          <>
            <Link
              to={`/clinic/appointments/new?patient=${patient.uuid}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-(--color-border) px-3 py-2 text-sm font-medium text-(--color-ink) hover:border-(--color-accent)/50"
            >
              <CalendarPlus className="h-4 w-4" /> New Appointment
            </Link>
            {staff?.can_edit_clinical && (
              <Link
                to={`/clinic/visits/new?patient=${patient.uuid}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-(--color-border) px-3 py-2 text-sm font-medium text-(--color-ink) hover:border-(--color-accent)/50"
              >
                <Stethoscope className="h-4 w-4" /> New Visit
              </Link>
            )}
            <Link
              to={`/clinic/patients/${patient.uuid}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-(--color-accent) px-3 py-2 text-sm font-medium text-white hover:bg-(--color-accent-hover)"
            >
              <Pencil className="h-4 w-4" /> Edit Patient
            </Link>
          </>
        }
      />

      {canSeeClinical && (
        <div className="mb-5">
          <PatientAlerts
            allergies={alerts.allergies}
            conditions={alerts.conditions}
            medications={alerts.medications}
          />
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-1 border-b border-(--color-border)">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === item.key
                ? 'border-(--color-accent) text-(--color-accent)'
                : 'border-transparent text-(--color-ink-soft) hover:text-(--color-ink)'
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="ml-1.5 text-xs text-(--color-ink-faint)">{item.count}</span>
            )}
          </button>
        ))}
        {canSeeClinical && (
          <Link
            to={`/clinic/patients/${patient.uuid}/history`}
            className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-(--color-ink-soft) hover:text-(--color-ink)"
          >
            Medical &amp; Dental History →
          </Link>
        )}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card>
            <CardTitle>Contact</CardTitle>
            <dl className="flex flex-col gap-2.5 text-sm">
              <Row label="Phone" value={patient.phone} />
              <Row label="Alternate" value={patient.alternate_phone} />
              <Row label="Email" value={patient.email} />
              <Row
                label="Address"
                value={[
                  patient.address_line_1,
                  patient.address_line_2,
                  patient.city,
                  patient.state,
                  patient.postal_code,
                  patient.country,
                ]
                  .filter(Boolean)
                  .join(', ')}
              />
              <Row label="Occupation" value={patient.occupation} />
              <Row label="Language" value={patient.preferred_language} />
            </dl>
          </Card>

          <Card>
            <CardTitle>Emergency Contact</CardTitle>
            <dl className="flex flex-col gap-2.5 text-sm">
              <Row label="Name" value={patient.emergency_contact_name} />
              <Row label="Phone" value={patient.emergency_contact_phone} />
              <Row label="Relationship" value={patient.emergency_contact_relationship} />
            </dl>
            <div className="mt-5 border-t border-(--color-border) pt-4">
              <dl className="flex flex-col gap-2.5 text-sm">
                <Row label="Blood Group" value={patient.blood_group} />
                <Row label="Date of Birth" value={formatDateShort(patient.date_of_birth)} />
                <Row label="Registered" value={formatDateShort(patient.created_at.slice(0, 10))} />
              </dl>
            </div>
          </Card>

          <Card>
            <CardTitle>Upcoming</CardTitle>
            {data.upcoming_appointments.length === 0 ? (
              <p className="text-sm text-(--color-ink-soft)">No upcoming appointments.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.upcoming_appointments.map((appointment) => (
                  <li key={appointment.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-(--color-ink)">
                        {formatDateShort(appointment.appointment_date)} ·{' '}
                        {formatTimeOfDay(appointment.appointment_time)}
                      </p>
                      <p className="truncate text-xs text-(--color-ink-soft)">
                        {appointment.reason}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </li>
                ))}
              </ul>
            )}

            {patient.notes && (
              <div className="mt-5 border-t border-(--color-border) pt-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-(--color-ink-faint)">
                  Notes
                </p>
                <p className="whitespace-pre-wrap text-sm text-(--color-ink-soft)">
                  {patient.notes}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'appointments' && (
        <Card padded={false}>
          {data.recent_appointments.length === 0 ? (
            <EmptyState title="No appointments yet" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Time</Th>
                  <Th>Reason</Th>
                  <Th>Source</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.recent_appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <Td className="whitespace-nowrap">
                      {formatDateShort(appointment.appointment_date)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatTimeOfDay(appointment.appointment_time)}
                    </Td>
                    <Td>{appointment.reason}</Td>
                    <Td className="text-(--color-ink-soft)">{appointment.source_display}</Td>
                    <Td>
                      <StatusBadge status={appointment.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      )}

      {tab === 'visits' && (
        <Card padded={false}>
          {data.recent_visits.length === 0 ? (
            <EmptyState
              title="No clinical visits recorded"
              hint="A visit is the record of an encounter that actually happened."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Chief Complaint</Th>
                  <Th>Diagnosis</Th>
                  <Th>Treatments</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.recent_visits.map((visit) => (
                  <tr key={visit.uuid} className="hover:bg-(--color-surface)/60">
                    <Td className="whitespace-nowrap">
                      <Link
                        to={`/clinic/visits/${visit.uuid}`}
                        className="font-medium text-(--color-accent) hover:underline"
                      >
                        {formatDateShort(visit.visit_date)}
                      </Link>
                    </Td>
                    <Td className="max-w-[240px] truncate">{visit.chief_complaint || '—'}</Td>
                    <Td className="max-w-[240px] truncate">{visit.diagnosis || '—'}</Td>
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
        </Card>
      )}

      {tab === 'treatments' && (
        <Card padded={false}>
          {data.recent_treatments.length === 0 ? (
            <EmptyState title="No treatments recorded" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Treatment</Th>
                  <Th>Tooth</Th>
                  <Th>Status</Th>
                  <Th>Cost</Th>
                </tr>
              </thead>
              <tbody>
                {data.recent_treatments.map((treatment) => (
                  <tr key={treatment.id}>
                    <Td className="whitespace-nowrap">
                      {formatDateShort(treatment.performed_date)}
                    </Td>
                    <Td className="font-medium">{treatment.name}</Td>
                    <Td>{treatment.tooth_number || '—'}</Td>
                    <Td>{treatment.status_display}</Td>
                    <Td>{treatment.cost ? `₹${treatment.cost}` : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      )}

      {tab === 'prescriptions' && (
        <div className="flex flex-col gap-4">
          {data.recent_prescriptions.length === 0 ? (
            <Card>
              <EmptyState title="No prescriptions issued" />
            </Card>
          ) : (
            data.recent_prescriptions.map((prescription) => (
              <Card key={prescription.uuid}>
                <CardTitle
                  actions={
                    <span className="text-sm text-(--color-ink-soft)">
                      {formatDateShort(prescription.prescribed_date)}
                    </span>
                  }
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-(--color-ink-faint)" />
                    Prescription
                  </span>
                </CardTitle>
                <ul className="flex flex-col gap-2">
                  {prescription.items.map((item, index) => (
                    <li key={item.id ?? index} className="text-sm">
                      <span className="font-medium text-(--color-ink)">
                        {item.medication_name}
                      </span>
                      <span className="text-(--color-ink-soft)">
                        {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
                        {item.instructions ? ` — ${item.instructions}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          )}
        </div>
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-(--color-ink-faint)">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-(--color-ink)">{value || '—'}</dd>
    </div>
  )
}
