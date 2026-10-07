export interface Faq {
  question: string
  answer: string
}

export const faqs: Faq[] = [
  {
    question: 'How do I book an appointment?',
    answer:
      'You can book an appointment through the online booking system or contact the clinic directly by phone.',
  },
  {
    question: 'Can I choose my preferred appointment time?',
    answer:
      "Yes. Available time slots will be displayed based on the dentist's availability.",
  },
  {
    question: 'What should I bring to my first appointment?',
    answer:
      'Bring any relevant previous dental records, prescriptions, scans, or reports if available.',
  },
  {
    question: 'Do you treat children?',
    answer: 'Yes, children’s dental care can be offered. Please contact the clinic for details.',
  },
  {
    question: 'Can I reschedule my appointment?',
    answer: 'Please contact the clinic as early as possible if you need to reschedule.',
  },
  {
    question: 'How often should I visit a dentist?',
    answer:
      'Regular dental examinations are generally recommended, but the appropriate interval depends on your individual oral-health needs.',
  },
  {
    question: 'Do you provide emergency dental care?',
    answer:
      'Contact the clinic directly to determine whether your dental concern can be accommodated as an urgent visit.',
  },
]
