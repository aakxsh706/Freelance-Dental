/**
 * Booking without a backend.
 *
 * The public website is a static site: there is no server to receive a
 * booking and no database to put it in. Requests go straight to the clinic's
 * Google Apps Script instead, which appends a row to the Bookings sheet. The
 * dentist reads that sheet on her phone or at the clinic.
 *
 * Two consequences the interface has to be honest about:
 *
 *   * Slot availability is worked out here, from the clinic's published
 *     hours, because nothing can be asked which times are already taken. A
 *     patient may therefore pick a slot that is no longer free, so the
 *     booking is a REQUEST the clinic confirms - which is what the wording on
 *     the confirmation screen already says.
 *
 *   * This endpoint is unauthenticated, because any key shipped in a public
 *     page is a published key. The script accepts only appends to the
 *     Bookings sheet; it cannot read anything and cannot reach patient
 *     records.
 */

import type { AppointmentInput, AvailabilityResponse, TimeSlot } from '../types'

export const BOOKING_WEBHOOK_URL = import.meta.env.VITE_BOOKING_WEBHOOK_URL ?? ''

/** True when the site is running without a backend. */
export function usingSheetBooking(): boolean {
  return Boolean(BOOKING_WEBHOOK_URL)
}

// Mon-Sat, matching the hours published on the site and seeded in the
// software. Sunday is closed.
const SESSIONS = [
  { start: '10:00', end: '14:00' },
  { start: '16:30', end: '20:00' },
]
const SLOT_MINUTES = 30

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function toClock(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * The times the clinic is open on a given date.
 *
 * Every slot is reported `available`: without a backend there is no way to
 * know what is taken. Marking them all free is the honest option — the
 * alternative is inventing a booked/free state the site cannot actually know.
 */
export function localAvailability(date: string): AvailabilityResponse {
  const slots: TimeSlot[] = []
  const day = new Date(`${date}T00:00:00`)

  // Sunday closed. getDay() is 0 for Sunday.
  if (!Number.isNaN(day.getTime()) && day.getDay() !== 0) {
    const now = new Date()
    const isToday = date === now.toISOString().slice(0, 10)
    const minutesNow = now.getHours() * 60 + now.getMinutes()

    for (const session of SESSIONS) {
      const end = toMinutes(session.end)
      for (let t = toMinutes(session.start); t + SLOT_MINUTES <= end; t += SLOT_MINUTES) {
        // An hour's notice: offering a slot 5 minutes from now wastes
        // everyone's time when a human still has to confirm it.
        if (isToday && t < minutesNow + 60) continue
        slots.push({ time: toClock(t), status: 'available' })
      }
    }
  }

  return { date, slots }
}

export class BookingError extends Error {}

/**
 * Send a booking request to the clinic's sheet.
 *
 * Sent as text/plain on purpose. A JSON content type makes the browser send a
 * CORS preflight, and Apps Script web apps do not answer preflight requests —
 * the booking would fail before it was ever sent. text/plain is a "simple"
 * request, so it goes straight through. The script parses the body as JSON
 * regardless of the header.
 */
export async function submitSheetBooking(input: AppointmentInput): Promise<void> {
  if (!BOOKING_WEBHOOK_URL) {
    throw new BookingError('Online booking is not configured for this site.')
  }

  let response: Response
  try {
    response = await fetch(BOOKING_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({ action: 'booking', ...input }),
    })
  } catch {
    throw new BookingError(
      'We could not reach the clinic just now. Please check your connection and try again, or call the clinic directly.',
    )
  }

  if (!response.ok) {
    throw new BookingError(
      'We could not submit your request. Please try again, or call the clinic directly.',
    )
  }

  // Apps Script answers with JSON, but via a redirect whose response is not
  // always readable from a browser. An unreadable body after a 200 is not a
  // failure, so only an explicit { ok: false } is treated as one.
  try {
    const text = await response.text()
    const body = JSON.parse(text)
    if (body && body.ok === false) {
      throw new BookingError(
        typeof body.error === 'string'
          ? body.error
          : 'The clinic could not record your request. Please call instead.',
      )
    }
  } catch (err) {
    if (err instanceof BookingError) throw err
    // Unreadable response - the row was almost certainly written.
  }
}
