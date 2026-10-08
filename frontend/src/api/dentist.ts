import type { Appointment, Dentist, DashboardStats } from '../types'
import { fallbackDentist } from '../data/clinicConfig'
import { API_BASE_URL, apiRequest, buildQuery } from './client'

export function getDentistProfile() {
  // See getClinicSettings - no backend on the public site.
  if (!API_BASE_URL) {
    return Promise.resolve(fallbackDentist)
  }
  return apiRequest<Dentist>('/dentist/profile/')
}

export function getDashboardStats() {
  return apiRequest<DashboardStats>('/dentist/stats/', { auth: true })
}

/** Today's queue, in the order patients will be seen. */
export function getTodayQueue(date?: string) {
  return apiRequest<{ date: string; appointments: Appointment[] }>(
    `/dentist/today/${buildQuery({ date })}`,
    { auth: true },
  )
}

export function getUpcomingAppointments(days = 7) {
  return apiRequest<Appointment[]>(`/dentist/upcoming/${buildQuery({ days })}`, { auth: true })
}
