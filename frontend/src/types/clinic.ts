/** Types for the internal clinic management software.
 *
 * Kept separate from `types/index.ts` (which the public website shares) so it
 * stays obvious which shapes carry patient-identifiable data.
 */

import type { Appointment, PatientBrief } from './index'

export type StaffRole = 'dentist' | 'admin' | 'assistant' | 'receptionist'

export interface StaffProfile {
  id: number
  username: string
  full_name: string
  role: StaffRole
  role_display: string
  phone: string
  is_active: boolean
  /** Capability flags from the server. The interface hides what a role cannot
   * do rather than offering an action that would fail on click. */
  can_view_clinical: boolean
  can_edit_clinical: boolean
  can_prescribe: boolean
  can_manage_settings: boolean
  can_view_audit: boolean
}

export type Gender = 'male' | 'female' | 'other' | 'undisclosed'

export interface PatientListRow {
  uuid: string
  patient_code: string
  full_name: string
  first_name: string
  last_name: string
  phone: string
  email: string
  date_of_birth: string | null
  age: number | null
  gender: Gender | ''
  is_active: boolean
  last_visit_date: string | null
  next_appointment_date: string | null
  created_at: string
}

export interface Patient {
  uuid: string
  patient_code: string
  first_name: string
  last_name: string
  display_name: string
  full_name: string
  phone: string
  alternate_phone: string
  email: string
  date_of_birth: string | null
  age: number | null
  gender: Gender | ''
  gender_display: string
  blood_group: string
  address_line_1: string
  address_line_2: string
  city: string
  state: string
  postal_code: string
  country: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  occupation: string
  preferred_language: string
  notes: string
  is_active: boolean
  merged_into_code: string | null
  created_at: string
  updated_at: string
}

export type PatientInput = Partial<Omit<Patient, 'uuid' | 'patient_code' | 'full_name' | 'age' | 'gender_display' | 'merged_into_code' | 'created_at' | 'updated_at'>>

export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'life_threatening'

export interface Allergy {
  id: number
  patient: string
  substance: string
  reaction: string
  severity: AllergySeverity
  severity_display: string
  notes: string
  is_active: boolean
}

export interface MedicalCondition {
  id: number
  patient: string
  condition: string
  diagnosed_date: string | null
  status: 'active' | 'managed' | 'resolved' | 'unknown'
  status_display: string
  notes: string
}

export interface PatientMedication {
  id: number
  patient: string
  medication_name: string
  dosage: string
  frequency: string
  start_date: string | null
  end_date: string | null
  notes: string
  is_active: boolean
}

export interface PastSurgery {
  id: number
  patient: string
  procedure: string
  surgery_date: string | null
  year: string
  hospital: string
  notes: string
}

export interface Hospitalization {
  id: number
  patient: string
  reason: string
  admitted_date: string | null
  discharged_date: string | null
  hospital: string
  notes: string
}

export interface FamilyMedicalHistory {
  id: number
  patient: string
  relationship: string
  condition: string
  notes: string
}

export interface MedicalProfile {
  smoking_status: string
  smoking_status_display: string
  alcohol_use: string
  alcohol_use_display: string
  pregnancy_status: string
  pregnancy_status_display: string
  other_notes: string
}

/** Every field is optional by design - intake happens over several visits. */
export interface DentalHistory {
  previous_treatments: string
  last_dental_visit: string | null
  oral_hygiene: string
  oral_hygiene_display: string
  brushing_frequency: string
  brushing_frequency_display: string
  flosses: boolean | null
  tooth_sensitivity: boolean | null
  tooth_sensitivity_notes: string
  bleeding_gums: boolean | null
  gum_disease: boolean | null
  bruxism: boolean | null
  orthodontic_history: boolean | null
  orthodontic_notes: string
  has_implants: boolean | null
  has_crowns: boolean | null
  has_bridges: boolean | null
  has_dentures: boolean | null
  root_canal_history: string
  extractions: string
  dental_material_reactions: string
  notes: string
}

export interface PatientHistory {
  medical_profile: MedicalProfile
  dental_history: DentalHistory
  allergies: Allergy[]
  conditions: MedicalCondition[]
  medications: PatientMedication[]
  surgeries: PastSurgery[]
  hospitalizations: Hospitalization[]
  family_history: FamilyMedicalHistory[]
}

export type TreatmentStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export interface Treatment {
  id: number
  patient: string
  visit: string | null
  name: string
  tooth_number: string
  surfaces: string
  description: string
  status: TreatmentStatus
  status_display: string
  performed_date: string | null
  cost: string | null
  notes: string
}

export interface PrescriptionItem {
  id?: number
  medication_name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

export interface Prescription {
  uuid: string
  patient: string
  patient_detail: PatientBrief | null
  visit: string | null
  prescribed_by_name: string | null
  prescribed_date: string
  notes: string
  items: PrescriptionItem[]
  created_at: string
}

export type VisitStatus = 'draft' | 'completed'

export interface ClinicalVisit {
  uuid: string
  patient: string
  patient_detail: PatientBrief | null
  appointment_id: number | null
  provider_name: string | null
  visit_date: string
  visit_time: string | null
  chief_complaint: string
  history_of_present_illness: string
  clinical_examination: string
  diagnosis: string
  treatment_performed: string
  clinical_notes: string
  follow_up_instructions: string
  next_visit_recommendation: string
  next_visit_date: string | null
  status: VisitStatus
  status_display: string
  completed_at: string | null
  treatments: Treatment[]
  prescriptions: Prescription[]
  created_at: string
  updated_at: string
}

export interface ClinicalVisitRow {
  uuid: string
  patient_detail: PatientBrief | null
  visit_date: string
  visit_time: string | null
  chief_complaint: string
  diagnosis: string
  status: VisitStatus
  status_display: string
  treatment_count: number
  created_at: string
}

export interface PatientDocument {
  uuid: string
  patient: string
  visit: string | null
  title: string
  document_type: string
  document_type_display: string
  file_url: string | null
  file_name: string
  notes: string
  created_at: string
}

export interface PatientSummary {
  patient: Patient
  alerts: {
    allergies: Allergy[]
    conditions: MedicalCondition[]
    medications: PatientMedication[]
  }
  counts: {
    appointments: number
    visits: number
    treatments: number
    prescriptions: number
    documents: number
  }
  recent_appointments: Appointment[]
  upcoming_appointments: Appointment[]
  recent_visits: ClinicalVisitRow[]
  recent_treatments: Treatment[]
  recent_prescriptions: Prescription[]
}

/** A website booking the matcher would not resolve, with the people it could
 * plausibly belong to. */
export interface AppointmentNeedingReview extends Appointment {
  candidates: Patient[]
}

export interface AuditLogEntry {
  id: number
  username: string
  action: string
  action_display: string
  model_name: string
  object_id: string
  object_repr: string
  patient_code: string | null
  patient_name: string | null
  changes: Record<string, unknown>
  ip_address: string | null
  timestamp: string
}

export interface MergePreview {
  target: Patient
  source: Patient
  will_move: Record<string, number>
}
