export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type AppointmentSource = 'website' | 'clinic' | 'phone' | 'walk_in' | 'other'

/** How a website booking was connected to a patient record. `ambiguous` means
 * the matcher found more than one plausible person and left it for staff. */
export type MatchStatus = 'linked' | 'created' | 'ambiguous' | 'unmatched'

/** Minimal patient shape embedded in appointment and visit payloads. */
export interface PatientBrief {
  uuid: string
  patient_code: string
  full_name: string
  phone: string
  age: number | null
}

export interface Appointment {
  id: number
  /** Null for a website booking the matcher could not resolve confidently. */
  patient: PatientBrief | null
  /** Snapshot of what the patient typed when booking - not kept in sync with
   * the patient record, so historical appointments stay accurate. */
  patient_name: string
  phone: string
  email: string
  reason: string
  appointment_date: string // YYYY-MM-DD
  appointment_time: string // HH:MM:SS
  notes: string
  status: AppointmentStatus
  status_display: string
  source: AppointmentSource
  source_display: string
  match_status: MatchStatus
  match_candidates: number[]
  needs_patient_review: boolean
  checked_in_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string
  has_visit: boolean
  visit_uuid: string | null
  created_at: string
  updated_at: string
}

export interface AppointmentInput {
  patient_name: string
  phone: string
  email: string
  reason: string
  appointment_date: string
  appointment_time: string
  notes?: string
}

export type SlotStatus = 'available' | 'booked'

export interface TimeSlot {
  time: string // HH:MM
  status: SlotStatus
}

export interface AvailabilityResponse {
  date: string
  slots: TimeSlot[]
}

export interface Dentist {
  id: number
  name: string
  title: string
  email: string
  phone: string
  bio: string
  profile_image: string
}

export interface ClinicSettings {
  clinic_name: string
  phone: string
  email: string
  address: string
  google_maps_embed_url: string
  google_maps_url: string
  slot_duration_minutes: number
}

export interface DentistAvailability {
  id: number
  day_of_week: number
  day_of_week_display: string
  start_time: string
  end_time: string
  is_active: boolean
}

export interface BlockedDate {
  id: number
  date: string
  reason: string
}

export interface DashboardStats {
  today_count: number
  by_status: Record<AppointmentStatus, number>
  last_7_days: { date: string; count: number }[]
  total_patients: number
  new_patients_this_month: number
  upcoming_count: number
  needs_review_count: number
  open_visits_count: number
  visits_this_month: number
}

/** Envelope returned by paginated endpoints (patients, audit logs, and any
 * list requested with ?page=). */
export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface AuthTokens {
  access: string
  refresh: string
}
