import type { ClinicSettings } from '../types'
import { apiRequest } from './client'

export function getClinicSettings() {
  return apiRequest<ClinicSettings>('/clinic/settings/')
}
