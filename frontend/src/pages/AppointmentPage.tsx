import { useNavigate } from 'react-router-dom'
import { AppointmentForm } from '../components/appointment/AppointmentForm'
import { StepIndicator } from '../components/appointment/StepIndicator'
import { Container } from '../components/ui/Container'
import { useBookingStore, type PatientDetails } from '../stores/bookingStore'

export function AppointmentPage() {
  const navigate = useNavigate()
  const { details, preferredDate, setDetails } = useBookingStore()

  function handleContinue(newDetails: PatientDetails, newPreferredDate: string) {
    setDetails(newDetails, newPreferredDate)
    navigate('/appointment/schedule')
  }

  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <StepIndicator current={1} />

        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold text-(--color-ink) sm:text-4xl">
            Book an Appointment
          </h1>
          <p className="text-base leading-relaxed text-(--color-ink-soft)">
            Tell us a little about your visit and we&rsquo;ll show you the dentist&rsquo;s
            available times.
          </p>
        </div>

        <div className="mx-auto w-full max-w-2xl rounded-2xl border border-(--color-border) bg-(--color-bg) p-6 sm:p-10">
          <AppointmentForm
            initialDetails={details}
            initialPreferredDate={preferredDate}
            onContinue={handleContinue}
          />
        </div>
      </Container>
    </section>
  )
}
