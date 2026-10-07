import { Navigate, useNavigate } from 'react-router-dom'
import { AppointmentConfirmation } from '../components/appointment/AppointmentConfirmation'
import { StepIndicator } from '../components/appointment/StepIndicator'
import { Container } from '../components/ui/Container'
import { useBookingStore } from '../stores/bookingStore'

export function AppointmentConfirmationPage() {
  const navigate = useNavigate()
  const { confirmedAppointment, reset } = useBookingStore()

  if (!confirmedAppointment) {
    return <Navigate to="/appointment" replace />
  }

  function handleBookAnother() {
    reset()
    navigate('/appointment')
  }

  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <StepIndicator current={3} />
        <AppointmentConfirmation appointment={confirmedAppointment} />
        <button
          onClick={handleBookAnother}
          className="mx-auto text-sm font-medium text-(--color-accent) hover:underline"
        >
          Book another appointment
        </button>
      </Container>
    </section>
  )
}
