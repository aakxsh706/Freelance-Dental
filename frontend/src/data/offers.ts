export interface Offer {
  title: string
  description: string
}

/** Sample offers only — replace with the clinic's real, verified pricing/promotions. */
export const offers: Offer[] = [
  {
    title: 'New Patient Offer',
    description: 'Initial consultation + basic dental examination.',
  },
  {
    title: 'Smile Care Offer',
    description: 'Professional cleaning + consultation.',
  },
  {
    title: 'Bright Smile Offer',
    description: 'Teeth whitening consultation with special introductory pricing.',
  },
]
