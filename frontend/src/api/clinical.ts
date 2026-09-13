import type { Paginated } from '../types'
import type {
  ClinicalVisit,
  ClinicalVisitRow,
  PatientDocument,
  Prescription,
  Treatment,
} from '../types/clinic'
import { apiRequest, buildQuery } from './client'

// --- Clinical visits -------------------------------------------------------

export type VisitQuery = {
  patient?: string
  status?: string
  search?: string
  date_from?: string
  date_to?: string
  page?: number
}

export function listVisits(params: VisitQuery = {}) {
  return apiRequest<ClinicalVisitRow[]>(`/visits/${buildQuery(params)}`, { auth: true })
}

export function listVisitsPaged(params: VisitQuery = {}) {
  return apiRequest<Paginated<ClinicalVisitRow>>(
    `/visits/${buildQuery({ page: 1, ...params })}`,
    { auth: true },
  )
}

export function getVisit(uuid: string) {
  return apiRequest<ClinicalVisit>(`/visits/${uuid}/`, { auth: true })
}

export function createVisit(input: Partial<ClinicalVisit> & { patient: string; visit_date: string }) {
  return apiRequest<ClinicalVisit>('/visits/', { method: 'POST', body: input, auth: true })
}

export function updateVisit(uuid: string, input: Partial<ClinicalVisit>) {
  return apiRequest<ClinicalVisit>(`/visits/${uuid}/`, {
    method: 'PATCH',
    body: input,
    auth: true,
  })
}

/** One click from a checked-in appointment to an open visit. Returns the
 * existing visit if one was already started. */
export function startVisitFromAppointment(appointmentId: number) {
  return apiRequest<ClinicalVisit>('/visits/start-from-appointment/', {
    method: 'POST',
    body: { appointment: appointmentId },
    auth: true,
  })
}

export function completeVisit(uuid: string, completeAppointment = true) {
  return apiRequest<ClinicalVisit>(`/visits/${uuid}/complete/`, {
    method: 'POST',
    body: { complete_appointment: completeAppointment },
    auth: true,
  })
}

// --- Treatments ------------------------------------------------------------

export function listTreatments(params: { patient?: string; visit?: string } = {}) {
  return apiRequest<Treatment[]>(`/treatments/${buildQuery(params)}`, { auth: true })
}

export function createTreatment(input: Partial<Treatment> & { patient: string; name: string }) {
  return apiRequest<Treatment>('/treatments/', { method: 'POST', body: input, auth: true })
}

export function updateTreatment(id: number, input: Partial<Treatment>) {
  return apiRequest<Treatment>(`/treatments/${id}/`, {
    method: 'PATCH',
    body: input,
    auth: true,
  })
}

export function deleteTreatment(id: number) {
  return apiRequest<void>(`/treatments/${id}/`, { method: 'DELETE', auth: true })
}

// --- Prescriptions ---------------------------------------------------------

export function listPrescriptions(params: { patient?: string; visit?: string; search?: string } = {}) {
  return apiRequest<Prescription[]>(`/prescriptions/${buildQuery(params)}`, { auth: true })
}

export function createPrescription(
  input: Pick<Prescription, 'patient' | 'prescribed_date' | 'items'> & Partial<Prescription>,
) {
  return apiRequest<Prescription>('/prescriptions/', {
    method: 'POST',
    body: input,
    auth: true,
  })
}

export function deletePrescription(uuid: string) {
  return apiRequest<void>(`/prescriptions/${uuid}/`, { method: 'DELETE', auth: true })
}

// --- Documents -------------------------------------------------------------

export function listDocuments(patientUuid: string) {
  return apiRequest<PatientDocument[]>(`/documents/${buildQuery({ patient: patientUuid })}`, {
    auth: true,
  })
}

export function uploadDocument(form: FormData) {
  return apiRequest<PatientDocument>('/documents/', {
    method: 'POST',
    body: form,
    auth: true,
  })
}

export function deleteDocument(uuid: string) {
  return apiRequest<void>(`/documents/${uuid}/`, { method: 'DELETE', auth: true })
}
