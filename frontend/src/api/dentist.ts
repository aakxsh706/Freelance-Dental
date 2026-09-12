import type { Dentist, DashboardStats } from '../types'
import { apiRequest } from './client'

export function getDentistProfile() {
  return apiRequest<Dentist>('/dentist/profile/')
}

export function getDashboardStats() {
  return apiRequest<DashboardStats>('/dentist/stats/', { auth: true })
}
