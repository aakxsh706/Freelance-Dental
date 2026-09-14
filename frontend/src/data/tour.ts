export interface TourStep {
  id: string
  /** CSS selector for the existing element this step highlights, or null for
   * the welcome/finish steps, which aren't tied to a specific section. */
  target: string | null
  title: string
  description: string
  ctaLabel: string
}

export const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    title: "Welcome to Belin's Dental Clinic",
    description:
      "Let your smile guide show you around. In just a few steps, I'll show you how to explore our care and book your visit.",
    ctaLabel: 'Next',
  },
  {
    id: 'services',
    target: '[data-tour="services-intro"]',
    title: 'Explore Your Dental Care',
    description:
      'Discover the treatments and services designed around your comfort, confidence, and long-term oral health.',
    ctaLabel: 'Next',
  },
  {
    id: 'service-cards',
    target: '[data-tour="service-cards"]',
    title: 'Find What You Need',
    description:
      'Explore the treatments that match your dental needs and learn more about the care we provide.',
    ctaLabel: 'Next',
  },
  {
    id: 'about',
    target: '#about',
    title: 'Know Your Dentist',
    description:
      'Learn more about the clinic, our approach, and what makes your experience comfortable and personal.',
    ctaLabel: 'Next',
  },
  {
    id: 'appointment',
    target: '#appointment',
    title: 'Ready to Visit?',
    description:
      'Choose a convenient date and available time, then book your appointment in just a few steps.',
    ctaLabel: 'Next',
  },
  {
    id: 'finish',
    target: null,
    title: 'Your Smile Journey Starts Here',
    description:
      "Everything you need is right here. Explore the clinic, find your care, and book when you're ready.",
    ctaLabel: 'Start Exploring',
  },
]
