import type { Paginated } from '../types'
import type { AuditLogEntry, StaffProfile } from '../types/clinic'
import { apiRequest, buildQuery } from './client'

/** Who am I and what may I do. Drives which navigation items render. */
export function getCurrentStaff() {
  return apiRequest<StaffProfile>('/auth/me/', { auth: true })
}

export type AuditQuery = {
  page?: number
  action?: string
  model?: string
  patient?: string
  username?: string
  search?: string
  date_from?: string
  date_to?: string
}

export function listAuditLogs(params: AuditQuery = {}) {
  return apiRequest<Paginated<AuditLogEntry>>(
    `/audit-logs/${buildQuery({ page: 1, ...params })}`,
    { auth: true },
  )
}

export function listPatientAudit(patientUuid: string) {
  return apiRequest<AuditLogEntry[]>(`/patients/${patientUuid}/audit/`, { auth: true })
}
