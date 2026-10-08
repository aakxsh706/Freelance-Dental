import type {
  AvailabilityResponse,
  BlockedDate,
  DentistAvailability,
} from '../types'
import { apiRequest } from './client'
import { localAvailability, usingSheetBooking } from './sheetBooking'

export function getAvailability(date: string) {
  // On the public static site there is no server to ask, so the open times
  // are worked out from the clinic's published hours instead. See
  // sheetBooking.ts for why every slot comes back as available.
  if (usingSheetBooking()) {
    return Promise.resolve(localAvailability(date))
  }
  return apiRequest<AvailabilityResponse>(`/availability/?date=${date}`)
}

export function listWorkingHours() {
  return apiRequest<DentistAvailability[]>('/dentist/availability/', { auth: true })
}

export function createWorkingHours(input: {
  day_of_week: number
  start_time: string
  end_time: string
  is_active?: boolean
}) {
  return apiRequest<DentistAvailability>('/dentist/availability/', {
    method: 'POST',
    body: input,
    auth: true,
  })
}

export function deleteWorkingHours(id: number) {
  return apiRequest<void>(`/dentist/availability/${id}/`, { method: 'DELETE', auth: true })
}

export function listBlockedDates() {
  return apiRequest<BlockedDate[]>('/dentist/blocked-dates/', { auth: true })
}

export function createBlockedDate(input: { date: string; reason?: string }) {
  return apiRequest<BlockedDate>('/dentist/blocked-dates/', {
    method: 'POST',
    body: input,
    auth: true,
  })
}

export function deleteBlockedDate(id: number) {
  return apiRequest<void>(`/dentist/blocked-dates/${id}/`, { method: 'DELETE', auth: true })
}
