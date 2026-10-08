import { AlertCircle, ArrowRight, CalendarClock, Globe, Plus, Stethoscope, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getWebsiteBookingPendingCount, listAppointmentsNeedingReview } from '../../api/appointments'
import { getDashboardStats, getTodayQueue, getUpcomingAppointments } from '../../api/dentist'
import { AppointmentStatusControl } from '../../components/clinic/AppointmentStatusControl'
import { NotificationNotice } from '../../components/clinic/NotificationNotice'
import { WalkInModal } from '../../components/clinic/WalkInModal'
import {
  ActionButton,
  Card,
  CardTitle,
  EmptyState,
  ErrorNote,
  PageHeader,
  Pill,
  Spinner,
  StatTile,
} from '../../components/clinic/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useFetch } from '../../hooks/useFetch'
import { formatDateShort, formatTimeOfDay, sourceLabels } from '../../lib/format'
import type { Appointment, NotificationOutcome } from '../../types'

function timeOfDayGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function ClinicDashboardPage() {
  const stats = useFetch(getDashboardStats, [])
  const queue = useFetch(() => getTodayQueue(), [])
  const upcoming = useFetch(() => getUpcomingAppointments(7), [])
  const review = useFetch(listAppointmentsNeedingReview, [])
  // Bookings the appointment sheet sync turned into appointments and nobody
  // has looked at yet - a more specific callout than the general "Pending"
  // stat tile, which also includes pending bookings made by phone or at the
  // desk.
  const websitePending = useFetch(getWebsiteBookingPendingCount, [])

  // Status changes made from the queue update in place rather than refetching
  // the whole dashboard - the row the user just acted on should not jump.
  const [queueOverrides, setQueueOverrides] = useState<Record<number, Appointment>>({})
  const [walkInOpen, setWalkInOpen] = useState(false)
  // Surfaced under the queue so staff see whether the confirmation email
  // actually reached the patient, not just that the status changed.
  const [lastNotice, setLastNotice] = useState<NotificationOutcome | null>(null)
  const todayAppointments = (queue.data?.appointments ?? []).map(
    (appointment) => queueOverrides[appointment.id] ?? appointment,
  )

  return (
    <>
      <PageHeader
        title={`${timeOfDayGreeting()}`}
        subtitle="Today's schedule, patient numbers and anything waiting on you."
        actions={
          <>
            <ActionButton onClick={() => setWalkInOpen(true)}>
              <UserPlus className="h-4 w-4" /> Walk-In
            </ActionButton>
            <Link
              to="/clinic/appointments/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-(--color-accent) px-3 py-2 text-sm font-medium text-white hover:bg-(--color-accent-hover)"
            >
              <Plus className="h-4 w-4" /> New Appointment
            </Link>
          </>
        }
      />

      {(websitePending.data ?? 0) > 0 && (
        <Link
          to="/clinic/appointments?source=website&status=pending"
          className="mb-4 flex items-center gap-2.5 rounded-xl border border-(--color-accent)/30 bg-(--color-accent-soft) px-4 py-3 hover:border-(--color-accent)/50"
        >
          <Globe className="h-4 w-4 shrink-0 text-(--color-accent)" strokeWidth={2} />
          <p className="flex-1 text-sm font-medium text-(--color-ink)">
            {websitePending.data} new booking{websitePending.data === 1 ? '' : 's'} from the website
          </p>
          <ArrowRight className="h-3.5 w-3.5 text-(--color-accent)" />
        </Link>
      )}

      {stats.error && <ErrorNote>{stats.error}</ErrorNote>}

      {stats.loading && <Spinner label="Loading clinic figures…" />}

      {stats.data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Today" value={stats.data.today_count} hint="appointments" tone="accent" />
            <StatTile label="Pending" value={stats.data.by_status.pending ?? 0} hint="awaiting confirmation" />
            <StatTile label="Confirmed" value={stats.data.by_status.confirmed ?? 0} />
            <StatTile label="Completed" value={stats.data.by_status.completed ?? 0} />
            <StatTile label="Cancelled" value={stats.data.by_status.cancelled ?? 0} />
            <StatTile label="No Show" value={stats.data.by_status.no_show ?? 0} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total Patients" value={stats.data.total_patients} />
            <StatTile
              label="New This Month"
              value={stats.data.new_patients_this_month}
              hint="patients added"
            />
            <StatTile label="Upcoming" value={stats.data.upcoming_count} hint="future appointments" />
            <StatTile
              label="Open Visits"
              value={stats.data.open_visits_count}
              hint="not yet signed off"
              tone={stats.data.open_visits_count > 0 ? 'warning' : 'default'}
            />
          </div>
        </>
      )}

      {(review.data?.length ?? 0) > 0 && (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" strokeWidth={2} />
          <div className="flex-1">
            <p className="text-sm font-medium text-(--color-ink)">
              {review.data!.length} website booking{review.data!.length === 1 ? '' : 's'} need a
              patient record chosen
            </p>
            <p className="mt-0.5 text-sm text-(--color-ink-soft)">
              More than one existing patient matched the phone number or email, so these were left
              for you rather than being merged automatically.
            </p>
            <Link
              to="/clinic/appointments?needs_review=1"
              className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-(--color-accent) hover:underline"
            >
              Review them <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" padded={false}>
          <div className="px-5 pt-5">
            <CardTitle
              actions={
                <Link
                  to="/clinic/appointments"
                  className="text-sm font-medium text-(--color-accent) hover:underline"
                >
                  All appointments
                </Link>
              }
            >
              Today&rsquo;s Appointments
            </CardTitle>
          </div>

          {queue.loading && <Spinner />}
          {queue.error && (
            <div className="px-5 pb-5">
              <ErrorNote>{queue.error}</ErrorNote>
            </div>
          )}
          {queue.data && todayAppointments.length === 0 && (
            <EmptyState
              title="Nothing scheduled today"
              hint="Bookings made on the website are picked up automatically, usually within a few minutes."
            />
          )}

          <ul className="divide-y divide-(--color-border)">
            {todayAppointments.map((appointment) => (
              <li
                key={appointment.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
              >
                <span className="w-20 shrink-0 font-display text-sm font-semibold text-(--color-ink)">
                  {formatTimeOfDay(appointment.appointment_time)}
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    to={`/clinic/appointments/${appointment.id}`}
                    className="truncate text-sm font-medium text-(--color-ink) hover:text-(--color-accent) hover:underline"
                  >
                    {appointment.patient_name}
                  </Link>
                  <p className="truncate text-sm text-(--color-ink-soft)">
                    {appointment.reason}
                    <span className="text-(--color-ink-faint)">
                      {' · '}
                      {sourceLabels[appointment.source] ?? appointment.source}
                    </span>
                  </p>
                  {appointment.checked_in_at && (
                    <p className="text-xs text-(--color-ink-faint)">
                      Arrived {formatTimeOfDay(appointment.checked_in_at.slice(11, 16))}
                      {appointment.arrival_delay_minutes !== null &&
                        appointment.arrival_delay_minutes > 5 &&
                        ` · ${appointment.arrival_delay_minutes} min late`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {appointment.needs_patient_review && <Pill tone="warning">Needs review</Pill>}
                  <StatusBadge status={appointment.status} />
                </div>

                <div className="flex items-center gap-2">
                  {appointment.status === 'checked_in' && !appointment.has_visit && (
                    <Link
                      to={`/clinic/visits/new?appointment=${appointment.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-(--color-accent)/40 px-2.5 py-1.5 text-xs font-medium text-(--color-accent) hover:bg-(--color-accent-soft)"
                    >
                      <Stethoscope className="h-3.5 w-3.5" /> Start visit
                    </Link>
                  )}
                  {appointment.has_visit && appointment.visit_uuid && (
                    <Link
                      to={`/clinic/visits/${appointment.visit_uuid}`}
                      className="text-xs font-medium text-(--color-accent) hover:underline"
                    >
                      Open visit
                    </Link>
                  )}
                  <AppointmentStatusControl
                    appointment={appointment}
                    compact
                    onChanged={(updated) => {
                      setQueueOverrides((prev) => ({ ...prev, [updated.id]: updated }))
                      stats.reload()
                    }}
                    onNotification={setLastNotice}
                  />
                </div>
              </li>
            ))}
          </ul>

          {lastNotice && (
            <div className="border-t border-(--color-border) px-5 py-3">
              <NotificationNotice
                outcome={lastNotice}
                successLabel="Confirmation email sent to the patient"
              />
            </div>
          )}
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardTitle>Upcoming</CardTitle>
          </div>
          {upcoming.loading && <Spinner />}
          {upcoming.data && upcoming.data.length === 0 && (
            <EmptyState title="Nothing booked in the next 7 days" />
          )}
          <ul className="divide-y divide-(--color-border)">
            {(upcoming.data ?? []).slice(0, 8).map((appointment) => (
              <li key={appointment.id} className="flex items-start gap-3 px-5 py-3">
                <CalendarClock
                  className="mt-0.5 h-4 w-4 shrink-0 text-(--color-ink-faint)"
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--color-ink)">
                    {appointment.patient_name}
                  </p>
                  <p className="text-xs text-(--color-ink-soft)">
                    {formatDateShort(appointment.appointment_date)} ·{' '}
                    {formatTimeOfDay(appointment.appointment_time)}
                  </p>
                </div>
                <StatusBadge status={appointment.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <WalkInModal
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        onDone={() => {
          setWalkInOpen(false)
          queue.reload()
          stats.reload()
        }}
      />
    </>
  )
}
