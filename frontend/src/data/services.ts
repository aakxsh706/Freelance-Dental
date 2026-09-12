import type { LucideIcon } from 'lucide-react'
import {
  Baby,
  Hammer,
  Heart,
  Scissors,
  Smile,
  Sparkles,
  Stethoscope,
  Wrench,
} from 'lucide-react'

export interface Service {
  title: string
  description: string
  icon: LucideIcon
}

export const services: Service[] = [
  {
    title: 'General Dentistry',
    description:
      'Routine examinations, cleaning, preventive dental care, and oral health guidance.',
    icon: Stethoscope,
  },
  {
    title: 'Teeth Cleaning',
    description:
      'Professional cleaning to remove plaque, tartar, and stains while maintaining healthy gums.',
    icon: Sparkles,
  },
  {
    title: 'Teeth Whitening',
    description: 'Professional whitening treatments designed to brighten your smile safely.',
    icon: Smile,
  },
  {
    title: 'Dental Fillings',
    description: 'Modern tooth-colored fillings to restore teeth affected by cavities.',
    icon: Wrench,
  },
  {
    title: 'Root Canal Treatment',
    description: 'Comfort-focused treatment to save infected or damaged teeth.',
    icon: Heart,
  },
  {
    title: 'Dental Crowns',
    description: 'Restoration and protection for damaged or weakened teeth.',
    icon: Hammer,
  },
  {
    title: 'Tooth Extraction',
    description: 'Safe and carefully planned extraction when a tooth cannot be preserved.',
    icon: Scissors,
  },
  {
    title: "Children's Dentistry",
    description: 'Gentle dental care designed to make dental visits comfortable for children.',
    icon: Baby,
  },
]
