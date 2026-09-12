export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface Appointment {
  id: number
  patient_name: string
  phone: string
  email: string
  reason: string
  appointment_date: string // YYYY-MM-DD
  appointment_time: string // HH:MM:SS
  notes: string
  status: AppointmentStatus
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
}

export interface AuthTokens {
  access: string
  refresh: string
}
