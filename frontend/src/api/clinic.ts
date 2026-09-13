import type { ClinicSettings } from '../types'
import { apiRequest } from './client'

export function getClinicSettings() {
  return apiRequest<ClinicSettings>('/clinic/settings/')
}

export function updateClinicSettings(input: Partial<ClinicSettings>) {
  return apiRequest<ClinicSettings>('/clinic/settings/', {
    method: 'PATCH',
    body: input,
    auth: true,
  })
}
