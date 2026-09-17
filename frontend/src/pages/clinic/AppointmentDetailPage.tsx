import {
  CalendarClock,
  CheckCircle2,
  Clock,
  LogIn,
  Stethoscope,
  User,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  checkInAppointment,
  confirmAppointment,
  getAppointment,
  getAppointmentHistory,
  resendAppointmentNotification,
  updateAppointmentStatus,
} from '../../api/appointments'
import { ApiError } from '../../api/client'
import { CancelModal } from '../../components/clinic/CancelModal'
import { NotificationNotice } from '../../components/clinic/NotificationNotice'
import { RescheduleModal } from '../../components/clinic/RescheduleModal'
import {
  ActionButton,
  Card,
  CardTitle,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  Pill,
  Spinner,
  TextInput,
} from '../../components/clinic/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useFetch } from '../../hooks/useFetch'
import {
  formatDateLong,
  formatDateShort,
  formatDateTime,
  formatTimeOfDay,
  sourceLabels,
} from '../../lib/format'
import type {
  Appointment,
  AppointmentActionResult,
  AppointmentHistoryEntry,
  AppointmentNotificationRow,
  NotificationOutcome,
} from '../../types'

/**
 * Everything about one appointment, and every action it can take.
 *
 * The actions offered are driven by the appointment's current state, so a
 * completed appointment shows no "Check In" button rather than showing one
 * that fails. The server enforces the same transitions regardless.
 */
export function AppointmentDetailPage() {
  const { appointmentId } = useParams()
  const id = Number(appointmentId)

  // Loaded through the shared hook so the loading/error plumbing matches the
  // rest of the clinic app; local state then tracks the action results.
  const fetched = useFetch(() => getAppointment(id), [id])
  const [edited, setEdited] = useState<Appointment | null>(null)
  const appointment = edited ?? fetched.data
  const [history, setHistory] = useState<AppointmentHistoryEntry[]>([])
  const [notifications, setNotifications] = useState<AppointmentNotificationRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<{ message: string; notification: NotificationOutcome } | null>(
    null,
  )

  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)

  const loadHistory = useCallback(() => {
    getAppointmentHistory(id)
      .then((data) => {
        setHistory(data.history)
        setNotifications(data.notifications)
      })
      .catch(() => undefined)
  }, [id])

  useEffect(loadHistory, [loadHistory])

  function applyResult(message: string, result: AppointmentActionResult) {
    setEdited(result.appointment)
    setOutcome({ message, notification: result.notification })
    loadHistory()
  }

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      applyResult('Appointment confirmed', await confirmAppointment(id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm this appointment.')
    } finally {
      setBusy(false)
    }
  }

  async function moveStatus(status: 'completed' | 'no_show') {
    setBusy(true)
    setError(null)
    try {
      setEdited(await updateAppointmentStatus(id, status))
      setOutcome(null)
      loadHistory()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this appointment.')
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    try {
      const result = await resendAppointmentNotification(id)
      applyResult('Notification retried', result)
    } catch {
      setError('Could not resend the notification.')
    }
  }

  if (fetched.loading && !appointment) return <Spinner label="Loading appointment…" />
  if ((error || fetched.error) && !appointment) {
    return <ErrorNote>{error ?? fetched.error}</ErrorNote>
  }
  if (!appointment) return null

  const status = appointment.status
  const canConfirm = status === 'pending'
  const canCheckIn = status === 'pending' || status === 'confirmed'
  const canReschedule = ['pending', 'confirmed', 'checked_in'].includes(status)
  const canCancel = ['pending', 'confirmed', 'checked_in'].includes(status)
  const canComplete = status === 'checked_in'
  const canNoShow = status === 'confirmed' || status === 'checked_in'

  return (
    <>
      <PageHeader
        title={appointment.patient_name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{formatDateLong(appointment.appointment_date)}</span>
            <span>{formatTimeOfDay(appointment.appointment_time)}</span>
            <Pill>{sourceLabels[appointment.source] ?? appointment.source}</Pill>
            {appointment.slot_override && <Pill tone="warning">Slot overridden</Pill>}
            {appointment.needs_patient_review && <Pill tone="warning">Needs patient review</Pill>}
          </span>
        }
        actions={
          <>
            {appointment.patient && (
              <Link
                to={`/clinic/patients/${appointment.patient.uuid}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-(--color-border) px-3 py-2 text-sm font-medium text-(--color-ink) hover:border-(--color-accent)/50"
              >
                <User className="h-4 w-4" /> Open Patient
              </Link>
            )}
            {canConfirm && (
              <ActionButton tone="primary" disabled={busy} onClick={accept}>
                <CheckCircle2 className="h-4 w-4" /> Accept Appointment
              </ActionButton>
            )}
            {canCheckIn && (
              <ActionButton
                tone={status === 'confirmed' ? 'primary' : 'secondary'}
                onClick={() => setCheckInOpen(true)}
              >
                <LogIn className="h-4 w-4" /> Check In
              </ActionButton>
            )}
            {canReschedule && (
              <ActionButton onClick={() => setRescheduleOpen(true)}>
                <CalendarClock className="h-4 w-4" /> Reschedule
              </ActionButton>
            )}
            {canComplete && (
              <ActionButton disabled={busy} onClick={() => moveStatus('completed')}>
                Complete
              </ActionButton>
            )}
            {canNoShow && (
              <ActionButton disabled={busy} onClick={() => moveStatus('no_show')}>
                Mark No-Show
              </ActionButton>
            )}
            {canCancel && (
              <ActionButton tone="danger" onClick={() => setCancelOpen(true)}>
                <XCircle className="h-4 w-4" /> Cancel
              </ActionButton>
            )}
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {outcome && (
        <div className="mb-5 flex flex-col gap-1.5 rounded-xl border border-(--color-border) bg-(--color-bg) px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-(--color-success)">
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
            {outcome.message}
          </p>
          <NotificationNotice
            outcome={outcome.notification}
            successLabel="Patient notification sent"
            onResend={resend}
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardTitle>Appointment</CardTitle>
          <dl className="flex flex-col gap-2.5 text-sm">
            <Row label="Status" value={<StatusBadge status={appointment.status} />} />
            <Row label="Date" value={formatDateShort(appointment.appointment_date)} />
            <Row label="Time" value={formatTimeOfDay(appointment.appointment_time)} />
            <Row label="Reason" value={appointment.reason} />
            <Row label="Source" value={sourceLabels[appointment.source] ?? appointment.source} />
            {appointment.notes && <Row label="Notes" value={appointment.notes} />}
            {appointment.slot_override && (
              <Row label="Override" value={appointment.slot_override_reason} />
            )}
            {appointment.cancellation_reason && (
              <Row label="Cancelled" value={appointment.cancellation_reason} />
            )}
          </dl>
        </Card>

        <Card>
          <CardTitle>Patient</CardTitle>
          <dl className="flex flex-col gap-2.5 text-sm">
            <Row
              label="Name"
              value={
                appointment.patient ? (
                  <Link
                    to={`/clinic/patients/${appointment.patient.uuid}`}
                    className="font-medium text-(--color-accent) hover:underline"
                  >
                    {appointment.patient_name}
                  </Link>
                ) : (
                  appointment.patient_name
                )
              }
            />
            <Row label="Patient ID" value={appointment.patient?.patient_code ?? 'Not linked'} />
            <Row label="Phone" value={appointment.phone} />
            <Row label="Email" value={appointment.email} />
          </dl>

          {appointment.has_visit && appointment.visit_uuid && (
            <Link
              to={`/clinic/visits/${appointment.visit_uuid}`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-(--color-accent) hover:underline"
            >
              <Stethoscope className="h-4 w-4" /> Open clinical visit
            </Link>
          )}
          {!appointment.has_visit && appointment.status === 'checked_in' && (
            <Link
              to={`/clinic/visits/new?appointment=${appointment.id}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-(--color-accent)/40 px-3 py-2 text-sm font-medium text-(--color-accent) hover:bg-(--color-accent-soft)"
            >
              <Stethoscope className="h-4 w-4" /> Start clinical visit
            </Link>
          )}
        </Card>

        <Card>
          <CardTitle>Timeline</CardTitle>
          <dl className="flex flex-col gap-2.5 text-sm">
            <Row label="Created" value={formatDateTime(appointment.created_at)} />
            <Row
              label="Confirmed"
              value={
                appointment.confirmed_at
                  ? `${formatDateTime(appointment.confirmed_at)}${
                      appointment.confirmed_by_name ? ` · ${appointment.confirmed_by_name}` : ''
                    }`
                  : '—'
              }
            />
            <Row
              label="Checked in"
              value={
                appointment.checked_in_at ? (
                  <span>
                    {formatDateTime(appointment.checked_in_at)}
                    {appointment.arrival_delay_minutes !== null && (
                      <span
                        className={
                          appointment.arrival_delay_minutes > 5
                            ? 'ml-1.5 text-(--color-danger)'
                            : 'ml-1.5 text-(--color-ink-soft)'
                        }
                      >
                        (
                        {appointment.arrival_delay_minutes > 0
                          ? `${appointment.arrival_delay_minutes} min late`
                          : appointment.arrival_delay_minutes < 0
                            ? `${Math.abs(appointment.arrival_delay_minutes)} min early`
                            : 'on time'}
                        )
                      </span>
                    )}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <Row
              label="Completed"
              value={appointment.completed_at ? formatDateTime(appointment.completed_at) : '—'}
            />
          </dl>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardTitle>History</CardTitle>
          </div>
          {history.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-(--color-ink-soft)">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-y divide-(--color-border)">
              {history.map((entry) => (
                <li key={entry.id} className="flex gap-3 px-5 py-3">
                  <Clock
                    className="mt-0.5 h-4 w-4 shrink-0 text-(--color-ink-faint)"
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-(--color-ink)">
                      {entry.event_type_display}
                      {entry.changed_by_name && (
                        <span className="font-normal text-(--color-ink-soft)">
                          {' '}
                          by {entry.changed_by_name}
                        </span>
                      )}
                    </p>
                    {entry.schedule_changed && (
                      <p className="text-sm text-(--color-ink-soft)">
                        {formatDateShort(entry.old_date)}{' '}
                        {formatTimeOfDay(entry.old_time)} →{' '}
                        <span className="font-medium text-(--color-ink)">
                          {formatDateShort(entry.new_date)} {formatTimeOfDay(entry.new_time)}
                        </span>
                      </p>
                    )}
                    {entry.reason && (
                      <p className="text-sm text-(--color-ink-soft)">Reason: {entry.reason}</p>
                    )}
                    <p className="mt-0.5 text-xs text-(--color-ink-faint)">
                      {formatDateTime(entry.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardTitle>Notifications</CardTitle>
          </div>
          {notifications.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-(--color-ink-soft)">
              No emails have been sent about this appointment.
            </p>
          ) : (
            <ul className="divide-y divide-(--color-border)">
              {notifications.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-(--color-ink)">
                      {row.notification_type_display}
                    </p>
                    <p className="truncate text-xs text-(--color-ink-soft)">
                      {row.recipient_email || 'No address'}
                    </p>
                    {row.failure_reason && (
                      <p className="text-xs text-(--color-danger)">{row.failure_reason}</p>
                    )}
                    <p className="mt-0.5 text-xs text-(--color-ink-faint)">
                      {row.sent_at ? formatDateTime(row.sent_at) : formatDateTime(row.created_at)}
                    </p>
                  </div>
                  <Pill
                    tone={
                      row.status === 'sent'
                        ? 'accent'
                        : row.status === 'failed'
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {row.status_display}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <RescheduleModal
        appointment={appointment}
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        onDone={(result) => applyResult('Appointment rescheduled', result)}
      />
      <CancelModal
        appointment={appointment}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onDone={(result) => applyResult('Appointment cancelled', result)}
      />
      <CheckInModal
        appointment={appointment}
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        onDone={(result) => applyResult('Patient checked in', result)}
      />
    </>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-(--color-ink-faint)">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-(--color-ink)">{value || '—'}</dd>
    </div>
  )
}

/**
 * Recording arrival.
 *
 * Shows the scheduled time next to the arrival field so it is visible that
 * these are two different facts and that only one of them is being set.
 */
interface CheckInModalProps {
  appointment: Appointment
  open: boolean
  onClose: () => void
  onDone: (result: AppointmentActionResult) => void
}

function CheckInModal(props: CheckInModalProps) {
  if (!props.open) return null
  return <CheckInModalBody {...props} />
}

function CheckInModalBody({ appointment, open, onClose, onDone }: CheckInModalProps) {
  // Defaults to now, in the local format the datetime input expects, but stays
  // editable - reception often records an arrival a few minutes after the fact.
  const [arrivedAt, setArrivedAt] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      onDone(await checkInAppointment(appointment.id, new Date(arrivedAt).toISOString()))
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check this patient in.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title="Check In Patient" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-(--color-ink-faint)">Scheduled for</p>
          <p className="text-sm font-medium text-(--color-ink)">
            {formatDateShort(appointment.appointment_date)} ·{' '}
            {formatTimeOfDay(appointment.appointment_time)}
          </p>
        </div>
        <Field
          label="Arrival Time"
          required
          hint="The scheduled time above is not changed by checking in."
        >
          <TextInput
            type="datetime-local"
            value={arrivedAt}
            onChange={(e) => setArrivedAt(e.target.value)}
          />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="primary" disabled={saving} onClick={submit}>
            {saving ? 'Checking in…' : 'Check In'}
          </ActionButton>
        </div>
      </div>
    </Modal>
  )
}
