import type { Appointment, AppointmentInput, AppointmentStatus } from '../types'
import { apiRequest } from './client'

export function createAppointment(input: AppointmentInput) {
  return apiRequest<Appointment>('/appointments/', {
    method: 'POST',
    body: input,
  })
}

export function listAppointments(params: { date?: string; today?: boolean } = {}) {
  const query = new URLSearchParams()
  if (params.date) query.set('date', params.date)
  if (params.today) query.set('today', '1')
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return apiRequest<Appointment[]>(`/appointments/${suffix}`, { auth: true })
}

export function updateAppointmentStatus(id: number, status: AppointmentStatus) {
  return apiRequest<Appointment>(`/appointments/${id}/`, {
    method: 'PATCH',
    body: { status },
    auth: true,
  })
}
