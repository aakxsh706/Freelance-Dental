import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { createAppointment } from '../api/appointments'
import { ApiError } from '../api/client'
import { AvailabilityCalendar } from '../components/appointment/AvailabilityCalendar'
import { StepIndicator } from '../components/appointment/StepIndicator'
import { TimeSlotSelector } from '../components/appointment/TimeSlotSelector'
import { Button } from '../components/ui/Button'
import { Container } from '../components/ui/Container'
import { formatDateLong, todayIso } from '../lib/format'
import { useBookingStore } from '../stores/bookingStore'

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

  if (!details.patient_name) {
    return <Navigate to="/appointment" replace />
  }

  const activeDate = selectedDate ?? todayIso()

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

        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 rounded-2xl border border-(--color-border) bg-(--color-bg) p-6 sm:p-10">
          <AvailabilityCalendar selectedDate={activeDate} onSelectDate={setSelectedDate} />

          <div className="flex flex-col gap-4">
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

          <Button
            onClick={handleConfirm}
            disabled={!selectedTime || submitting}
            className="self-start"
          >
            {submitting ? 'Submitting…' : 'Confirm Appointment Request'}
          </Button>
        </div>
      </Container>
    </section>
  )
}
