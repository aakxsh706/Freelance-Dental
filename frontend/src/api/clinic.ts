import type { ClinicSettings } from '../types'
import { fallbackClinicSettings } from '../data/clinicConfig'
import { API_BASE_URL, apiRequest } from './client'

export function getClinicSettings() {
  // No backend on the public site. Returning the bundled values directly
  // avoids a request that can only fail, and the failure noise in the
  // console that comes with it - the components fall back to these anyway.
  if (!API_BASE_URL) {
    return Promise.resolve(fallbackClinicSettings)
  }
  return apiRequest<ClinicSettings>('/clinic/settings/')
}

export function updateClinicSettings(input: Partial<ClinicSettings>) {
  return apiRequest<ClinicSettings>('/clinic/settings/', {
    method: 'PATCH',
    body: input,
    auth: true,
  })
}
