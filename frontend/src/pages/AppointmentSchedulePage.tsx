import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { createAppointment } from '../api/appointments'
import { ApiError } from '../api/client'
import { AvailabilityCalendar } from '../components/appointment/AvailabilityCalendar'
import { HappyToothCompanion } from '../components/appointment/HappyToothCompanion'
import { StepIndicator } from '../components/appointment/StepIndicator'
import { TimeSlotSelector } from '../components/appointment/TimeSlotSelector'
import { Button } from '../components/ui/Button'
import { Container } from '../components/ui/Container'
import type { BookingMascotState } from '../data/bookingMascot'
import { clinicTimings } from '../data/clinicConfig'
import { formatDateLong, todayIso } from '../lib/format'
import { useBookingStore } from '../stores/bookingStore'

const TIME_SELECTED_DISPLAY_MS = 1600

export function AppointmentSchedulePage() {
  const navigate = useNavigate()
  const {
    details,
    selectedDate,
    selectedTime,
    setSelectedDate,
    setSelectedTime,
    setConfirmedAppointment,
  } = useBookingStore()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // "That works!" briefly, then settles into "Almost there!" while the
  // confirm button waits to be pressed — a cosmetic sequencing of copy for
  // an already-genuine selection, not a stand-in for any real booking state.
  const [timePhase, setTimePhase] = useState<'time-selected' | 'ready'>('ready')

  // Synchronizes with an external timer, not derivable during render.
  useEffect(() => {
    if (!selectedTime) return
    // oxlint-disable-next-line set-state-in-effect
    setTimePhase('time-selected')
    const timer = window.setTimeout(() => setTimePhase('ready'), TIME_SELECTED_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [selectedTime])

  if (!details.patient_name) {
    return <Navigate to="/appointment" replace />
  }

  const activeDate = selectedDate ?? todayIso()

  const mascotState: BookingMascotState = submitError
    ? 'error'
    : submitting
      ? 'submitting'
      : selectedTime
        ? timePhase
        : 'date-selected'

  async function handleConfirm() {
    if (!selectedTime) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const appointment = await createAppointment({
        patient_name: details.patient_name,
        phone: details.phone,
        email: details.email,
        reason: details.reason,
        notes: details.notes,
        appointment_date: activeDate,
        appointment_time: selectedTime,
      })
      setConfirmedAppointment(appointment)
      navigate('/appointment/confirmation')
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : 'We could not submit your appointment request. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <StepIndicator current={2} />

        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold text-(--color-ink) sm:text-4xl">
            Dr. Belin&rsquo;s Availability
          </h1>
          <p className="text-base leading-relaxed text-(--color-ink-soft)">
            Choose a date, then pick from the available time slots below.
          </p>
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-col-reverse gap-8 lg:flex-row lg:items-start">
          <div className="flex w-full flex-col gap-8 rounded-2xl border border-(--color-border) bg-(--color-bg) p-6 sm:p-10 lg:max-w-2xl">
            <div data-mascot-target="appointment-calendar">
              <AvailabilityCalendar selectedDate={activeDate} onSelectDate={setSelectedDate} />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-(--color-surface) px-4 py-3 text-xs text-(--color-ink-soft)">
              <span className="font-semibold text-(--color-ink)">Clinic Timings</span>
              {clinicTimings.map((session) => (
                <span key={session.label}>{session.hours}</span>
              ))}
            </div>

            <div data-mascot-target="appointment-time-slots" className="flex flex-col gap-4">
              <h2 className="text-sm font-medium text-(--color-ink)">
                Available times for {formatDateLong(activeDate)}
              </h2>
              <TimeSlotSelector
                date={activeDate}
                selectedTime={selectedTime}
                onSelectTime={setSelectedTime}
              />
            </div>

            {submitError && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-(--color-danger)">
                {submitError}
              </p>
            )}

            <div data-mascot-target="appointment-submit" className="self-start">
              <Button onClick={handleConfirm} disabled={!selectedTime || submitting}>
                {submitting ? 'Submitting…' : 'Confirm Appointment Request'}
              </Button>
            </div>
          </div>

          <HappyToothCompanion state={mascotState} className="lg:w-56 lg:flex-none lg:pt-6" />
        </div>
      </Container>
    </section>
  )
}
