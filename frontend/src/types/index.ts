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
  /** What the patient originally asked for. Frozen at booking; unlike
   * appointment_date/time it does not move when staff reschedule. */
  requested_date: string | null
  requested_time: string | null
  /** True when the approved time differs from the requested one. */
  was_moved_before_confirming: boolean
  confirmed_at: string | null
  confirmed_by_name: string
  /** When the patient actually arrived. A different fact from
   * `appointment_time`, which is when they were booked, and never overwrites
   * it - see arrival_delay_minutes. */
  checked_in_at: string | null
  checked_in_by_name: string
  /** Minutes late; negative means early. Null until check-in, and null for
   * walk-ins whose scheduled time is their arrival time by definition. */
  arrival_delay_minutes: number | null
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string
  /** Set when staff deliberately booked over an existing appointment. */
  slot_override: boolean
  slot_override_reason: string
  has_visit: boolean
  visit_uuid: string | null
  /** True when this appointment has been moved at least once; its history
   * holds the previous date and time. */
  was_rescheduled: boolean
  last_notification: {
    notification_type: string
    status: NotificationStatus
    recipient_email: string
    failure_reason: string
    sent_at: string | null
  } | null
  created_at: string
  updated_at: string
}

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped'

/** What the server did about emailing the patient.
 *
 * Always separate from the appointment in an action's response: the
 * appointment change is authoritative and already saved, the email is a side
 * effect that may have failed. The interface reports the two independently. */
export interface NotificationOutcome {
  attempted: boolean
  status: NotificationStatus | 'not_sent'
  recipient?: string
  detail: string
  sent_at?: string | null
  /** Whether the message actually left the server. False when a console or
   * in-memory backend is configured, where Django reports a successful send
   * for a message it printed and discarded. */
  delivered?: boolean
  /** False when no real mail backend is configured at all. */
  delivery_configured?: boolean
}

export interface AppointmentActionResult {
  appointment: Appointment
  notification: NotificationOutcome
  changed_fields?: string[]
  patient_created?: boolean
}

export type AppointmentEventType =
  | 'created'
  | 'confirmed'
  | 'rescheduled'
  | 'edited'
  | 'checked_in'
  | 'arrival_corrected'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'slot_override'

export interface AppointmentHistoryEntry {
  id: number
  event_type: AppointmentEventType
  event_type_display: string
  changed_by_name: string
  old_date: string | null
  old_time: string | null
  new_date: string | null
  new_time: string | null
  old_status: string
  new_status: string
  reason: string
  detail: Record<string, unknown>
  schedule_changed: boolean
  created_at: string
}

export interface AppointmentNotificationRow {
  id: number
  notification_type: string
  notification_type_display: string
  recipient_email: string
  subject: string
  status: NotificationStatus
  status_display: string
  sent_at: string | null
  failure_reason: string
  attempts: number
  created_at: string
}

/** The appointment a proposed booking would collide with, returned on a 409. */
export interface SlotConflictInfo {
  detail: string
  conflict: {
    id: number
    patient_name: string
    patient_code: string | null
    appointment_date: string
    appointment_time: string
    status: AppointmentStatus
    status_display: string
    reason: string
  }
  can_override: boolean
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
