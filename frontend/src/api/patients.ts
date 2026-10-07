import type { Paginated } from '../types'
import type {
  Allergy,
  FamilyMedicalHistory,
  Hospitalization,
  MedicalCondition,
  MergePreview,
  Patient,
  PatientHistory,
  PatientInput,
  PatientListRow,
  PatientMedication,
  PatientSummary,
  PastSurgery,
} from '../types/clinic'
import { apiRequest, buildQuery } from './client'

export type PatientQuery = {
  search?: string
  page?: number
  page_size?: number
  sort?: string
  is_active?: string
  gender?: string
}

/** Search and paging happen on the server - the directory is never downloaded
 * in full to be filtered in the browser. */
export function listPatients(params: PatientQuery = {}) {
  return apiRequest<Paginated<PatientListRow>>(
    `/patients/${buildQuery({ page: 1, ...params })}`,
    { auth: true },
  )
}

export function getPatient(uuid: string) {
  return apiRequest<Patient>(`/patients/${uuid}/`, { auth: true })
}

export function getPatientSummary(uuid: string) {
  return apiRequest<PatientSummary>(`/patients/${uuid}/summary/`, { auth: true })
}

export function getPatientHistory(uuid: string) {
  return apiRequest<PatientHistory>(`/patients/${uuid}/history/`, { auth: true })
}

export function createPatient(input: PatientInput) {
  return apiRequest<Patient>('/patients/', { method: 'POST', body: input, auth: true })
}

export function updatePatient(uuid: string, input: PatientInput) {
  return apiRequest<Patient>(`/patients/${uuid}/`, {
    method: 'PATCH',
    body: input,
    auth: true,
  })
}

export function updateMedicalProfile(uuid: string, input: Record<string, unknown>) {
  return apiRequest(`/patients/${uuid}/medical-profile/`, {
    method: 'PATCH',
    body: input,
    auth: true,
  })
}

export function updateDentalHistory(uuid: string, input: Record<string, unknown>) {
  return apiRequest(`/patients/${uuid}/dental-history/`, {
    method: 'PATCH',
    body: input,
    auth: true,
  })
}

export function getMergePreview(targetUuid: string, sourceUuid: string) {
  return apiRequest<MergePreview>(
    `/patients/${targetUuid}/merge-preview/${buildQuery({ source: sourceUuid })}`,
    { auth: true },
  )
}

export function mergePatients(targetUuid: string, sourceUuid: string) {
  return apiRequest<{ patient: Patient; merged_from: string; moved: Record<string, number> }>(
    `/patients/${targetUuid}/merge/`,
    { method: 'POST', body: { source: sourceUuid }, auth: true },
  )
}

// --- Structured medical history -------------------------------------------
// Each record type is its own endpoint filtered by ?patient=<uuid>, so history
// is queryable rather than buried in one free-text blob.

function historyApi<T>(resource: string) {
  return {
    list: (patientUuid: string) =>
      apiRequest<T[]>(`/${resource}/${buildQuery({ patient: patientUuid })}`, { auth: true }),
    create: (input: Partial<T> & { patient: string }) =>
      apiRequest<T>(`/${resource}/`, { method: 'POST', body: input, auth: true }),
    update: (id: number, input: Partial<T>) =>
      apiRequest<T>(`/${resource}/${id}/`, { method: 'PATCH', body: input, auth: true }),
    remove: (id: number) =>
      apiRequest<void>(`/${resource}/${id}/`, { method: 'DELETE', auth: true }),
  }
}

export const allergiesApi = historyApi<Allergy>('allergies')
export const conditionsApi = historyApi<MedicalCondition>('medical-conditions')
export const medicationsApi = historyApi<PatientMedication>('medications')
export const surgeriesApi = historyApi<PastSurgery>('surgeries')
export const hospitalizationsApi = historyApi<Hospitalization>('hospitalizations')
export const familyHistoryApi = historyApi<FamilyMedicalHistory>('family-history')
