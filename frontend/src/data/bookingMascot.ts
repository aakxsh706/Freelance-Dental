export type BookingMascotState =
  | 'initial'
  | 'date-selected'
  | 'time-selected'
  | 'ready'
  | 'submitting'
  | 'success'
  | 'error'

interface BookingMascotConfig {
  message: string
  supportingText?: string
  /** Target scale for this state — distinct values between adjacent states
   * in the normal flow are what make the transition itself read as a
   * reaction, without needing a separate replay-triggered animation. */
  scale: number
  /** CSS selector (matched via `document.querySelector`) for the existing
   * booking element this state should visually lean toward — e.g. the
   * calendar, the time slots, or the submit button — tagged in the page via
   * a stable `data-mascot-target` attribute. Omitted for the calm states
   * (initial/success) that don't chase anything. */
  targetSelector?: string
}

export const bookingMascotConfig: Record<BookingMascotState, BookingMascotConfig> = {
  initial: {
    message: "Let's find a time!",
    scale: 1,
  },
  'date-selected': {
    message: 'Good choice!',
    supportingText: "Now let's find a time that works for you.",
    scale: 1.08,
    targetSelector: '[data-mascot-target="appointment-calendar"]',
  },
  'time-selected': {
    message: 'That works!',
    scale: 1.14,
    targetSelector: '[data-mascot-target="appointment-time-slots"]',
  },
  ready: {
    message: 'Almost there!',
    supportingText: 'Everything looks good.',
    scale: 1.2,
    targetSelector: '[data-mascot-target="appointment-submit"]',
  },
  submitting: {
    message: 'Just a moment…',
    scale: 1.15,
    targetSelector: '[data-mascot-target="appointment-submit"]',
  },
  success: {
    message: "You're all set!",
    supportingText: 'Your appointment has been booked successfully.',
    scale: 1.4,
  },
  error: {
    message: "Hmm, let's try that again.",
    supportingText: 'Please choose another time and try once more.',
    scale: 1,
    targetSelector: '[data-mascot-target="appointment-time-slots"]',
  },
}
