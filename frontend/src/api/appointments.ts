import type {
  Appointment,
  AppointmentActionResult,
  AppointmentHistoryEntry,
  AppointmentNotificationRow,
  AppointmentStatus,
  AppointmentInput,
  Paginated,
  SlotConflictInfo,
} from '../types'
import type { PatientListRow } from '../types/clinic'
import type { AppointmentNeedingReview } from '../types/clinic'
import { ApiError, apiRequest, buildQuery } from './client'

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


// --- Workflow actions ------------------------------------------------------
//
// Each returns both what happened to the appointment and what happened to the
// patient's email, because those succeed and fail independently: an email that
// bounces must never be reported as a failed confirmation.

/** Accept a pending booking. Staff only - the public site cannot reach this. */
export function confirmAppointment(id: number, notify = true) {
  return apiRequest<AppointmentActionResult>(`/appointments/${id}/confirm/`, {
    method: 'POST',
    body: { notify },
    auth: true,
  })
}

export interface RescheduleInput {
  appointment_date: string
  appointment_time: string
  reason: string
  notify?: boolean
  override?: boolean
  override_reason?: string
}

/** Move an appointment. A reason is required, and the previous schedule is
 * kept in the appointment's history rather than being overwritten. */
export function rescheduleAppointment(id: number, input: RescheduleInput) {
  return apiRequest<AppointmentActionResult>(`/appointments/${id}/reschedule/`, {
    method: 'POST',
    body: input,
    auth: true,
  })
}

export interface EditAppointmentInput {
  reason?: string
  notes?: string
  phone?: string
  email?: string
  appointment_date?: string
  appointment_time?: string
  change_reason?: string
  notify?: boolean
  override?: boolean
  override_reason?: string
}

export function editAppointment(id: number, input: EditAppointmentInput) {
  return apiRequest<AppointmentActionResult>(`/appointments/${id}/edit/`, {
    method: 'POST',
    body: input,
    auth: true,
  })
}

/** Record the patient's arrival. `arrived_at` defaults to now on the server
 * and never changes the scheduled time. */
export function checkInAppointment(id: number, arrivedAt?: string) {
  return apiRequest<AppointmentActionResult>(`/appointments/${id}/check-in/`, {
    method: 'POST',
    body: arrivedAt ? { arrived_at: arrivedAt } : {},
    auth: true,
  })
}

export function cancelAppointment(id: number, reason: string, notify = true) {
  return apiRequest<AppointmentActionResult>(`/appointments/${id}/cancel/`, {
    method: 'POST',
    body: { reason, notify },
    auth: true,
  })
}

export function getAppointmentHistory(id: number) {
  return apiRequest<{
    history: AppointmentHistoryEntry[]
    notifications: AppointmentNotificationRow[]
  }>(`/appointments/${id}/history/`, { auth: true })
}

export function resendAppointmentNotification(id: number) {
  return apiRequest<AppointmentActionResult>(`/appointments/${id}/resend-notification/`, {
    method: 'POST',
    auth: true,
  })
}

// --- Walk-ins --------------------------------------------------------------

export interface WalkInInput {
  /** Either an existing patient's uuid... */
  patient?: string
  /** ...or the minimum needed to create one, without leaving the form. */
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  date_of_birth?: string | null
  gender?: string
  reason: string
  arrived_at?: string
  notes?: string
}

export function registerWalkIn(input: WalkInInput) {
  return apiRequest<AppointmentActionResult>('/appointments/walk-in/', {
    method: 'POST',
    body: input,
    auth: true,
  })
}

/** Patient lookup for the walk-in form.
 *
 * `likely_existing` is a duplicate warning: patients already holding the phone
 * or email being typed, so reception sees them before creating a second record
 * for somebody already on file. */
export function searchWalkInPatients(params: { search?: string; phone?: string; email?: string }) {
  return apiRequest<{ results: PatientListRow[]; likely_existing: PatientListRow[] }>(
    `/appointments/walk-in/search/${buildQuery(params)}`,
    { auth: true },
  )
}

/** Narrow an unknown error to a 409 slot conflict, which carries the
 * appointment already holding the slot. */
export function asSlotConflict(error: unknown): SlotConflictInfo | null {
  if (!(error instanceof ApiError) || (error.status !== 409 && error.status !== 403)) return null
  const body = error.body as SlotConflictInfo | null
  return body && body.conflict ? body : null
}
