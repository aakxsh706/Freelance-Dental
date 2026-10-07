import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Appointment } from '../types'

export interface PatientDetails {
  patient_name: string
  phone: string
  email: string
  reason: string
  notes: string
}

const emptyDetails: PatientDetails = {
  patient_name: '',
  phone: '',
  email: '',
  reason: '',
  notes: '',
}

interface BookingState {
  details: PatientDetails
  preferredDate: string | null
  selectedDate: string | null
  selectedTime: string | null
  confirmedAppointment: Appointment | null
  setDetails: (details: PatientDetails, preferredDate: string | null) => void
  setSelectedDate: (date: string | null) => void
  setSelectedTime: (time: string | null) => void
  setConfirmedAppointment: (appointment: Appointment) => void
  reset: () => void
}

/** Session-scoped (not persisted across browser restarts) so the multi-step
 * booking flow survives a page navigation/refresh but doesn't leak a stale
 * draft into a later, unrelated visit. */
export const useBookingStore = create<BookingState>()(
  persist(
    (set) => ({
      details: emptyDetails,
      preferredDate: null,
      selectedDate: null,
      selectedTime: null,
      confirmedAppointment: null,
      setDetails: (details, preferredDate) =>
        set({ details, preferredDate, selectedDate: preferredDate }),
      setSelectedDate: (date) => set({ selectedDate: date, selectedTime: null }),
      setSelectedTime: (time) => set({ selectedTime: time }),
      setConfirmedAppointment: (appointment) => set({ confirmedAppointment: appointment }),
      reset: () =>
        set({
          details: emptyDetails,
          preferredDate: null,
          selectedDate: null,
          selectedTime: null,
          confirmedAppointment: null,
        }),
    }),
    {
      name: 'belins-appointment-draft',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
