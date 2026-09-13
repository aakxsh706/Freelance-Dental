import type { Appointment, Dentist, DashboardStats } from '../types'
import { apiRequest, buildQuery } from './client'

export function getDentistProfile() {
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
