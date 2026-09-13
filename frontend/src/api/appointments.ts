import type { Appointment, AppointmentStatus, AppointmentInput, Paginated } from '../types'
import type { AppointmentNeedingReview } from '../types/clinic'
import { apiRequest, buildQuery } from './client'

/** Public booking - the one appointment call the website makes. */
export function createAppointment(input: AppointmentInput) {
  return apiRequest<Appointment>('/appointments/', {
    method: 'POST',
    body: input,
  })
}

export type AppointmentQuery = {
  date?: string
  date_from?: string
  date_to?: string
  today?: boolean
  upcoming?: boolean
  /** Comma-separated, so the board can ask for several statuses at once. */
  status?: string
  patient?: string
  source?: string
  search?: string
  needs_review?: boolean
  ordering?: string
  page?: number
  page_size?: number
}

/** Without a `page` parameter this returns a bare array, which is the contract
 * the original dashboard was written against. */
export function listAppointments(params: AppointmentQuery = {}) {
  return apiRequest<Appointment[]>(`/appointments/${buildQuery({ ...params })}`, {
    auth: true,
  })
}

export function listAppointmentsPaged(params: AppointmentQuery = {}) {
  return apiRequest<Paginated<Appointment>>(
    `/appointments/${buildQuery({ page: 1, ...params })}`,
    { auth: true },
  )
}

export function getAppointment(id: number) {
  return apiRequest<Appointment>(`/appointments/${id}/`, { auth: true })
}

export function updateAppointmentStatus(
  id: number,
  status: AppointmentStatus,
  cancellationReason?: string,
) {
  return apiRequest<Appointment>(`/appointments/${id}/`, {
    method: 'PATCH',
    body: { status, ...(cancellationReason ? { cancellation_reason: cancellationReason } : {}) },
    auth: true,
  })
}

export interface StaffAppointmentInput {
  patient?: string | null
  patient_name?: string
  phone?: string
  email?: string
  reason: string
  appointment_date: string
  appointment_time: string
  notes?: string
  status?: AppointmentStatus
  source?: string
}

export function createStaffAppointment(input: StaffAppointmentInput) {
  return apiRequest<Appointment>('/appointments/', {
    method: 'POST',
    body: input,
    auth: true,
  })
}

/** Reschedule or edit. Sending more than `status` switches the server to the
 * full-edit serializer, which re-runs slot collision checks. */
export function updateAppointment(id: number, input: Partial<StaffAppointmentInput>) {
  return apiRequest<Appointment>(`/appointments/${id}/`, {
    method: 'PATCH',
    body: input,
    auth: true,
  })
}

export function deleteAppointment(id: number) {
  return apiRequest<void>(`/appointments/${id}/`, { method: 'DELETE', auth: true })
}

export function getCalendar(start: string, end: string) {
  return apiRequest<{ start: string; end: string; appointments: Appointment[] }>(
    `/appointments/calendar/${buildQuery({ start, end })}`,
    { auth: true },
  )
}

/** Website bookings the matcher would not resolve confidently. */
export function listAppointmentsNeedingReview() {
  return apiRequest<AppointmentNeedingReview[]>('/appointments/needs-review/', { auth: true })
}

export function resolveAppointmentPatient(
  id: number,
  payload: { patient?: string; create_new?: boolean },
) {
  return apiRequest<Appointment>(`/appointments/${id}/resolve-patient/`, {
    method: 'POST',
    body: payload,
    auth: true,
  })
}
