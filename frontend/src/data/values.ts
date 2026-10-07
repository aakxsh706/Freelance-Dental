import type { LucideIcon } from 'lucide-react'
import { Compass, HeartHandshake, MessageCircle, ShieldCheck, Sprout } from 'lucide-react'

export interface CoreValue {
  title: string
  description: string
  icon: LucideIcon
}

export const coreValues: CoreValue[] = [
  {
    title: 'Patient First',
    description: "Every treatment begins with understanding the patient's needs and concerns.",
    icon: HeartHandshake,
  },
  {
    title: 'Comfort & Care',
    description: 'We strive to make every visit calm, comfortable, and reassuring.',
    icon: Sprout,
  },
  {
    title: 'Honest Dentistry',
    description: 'Clear explanations and transparent treatment recommendations.',
    icon: MessageCircle,
  },
  {
    title: 'Modern Approach',
    description: 'Using modern dental techniques and technology wherever appropriate.',
    icon: Compass,
  },
  {
    title: 'Long-Term Wellness',
    description:
      'Our goal is not just to treat dental problems, but to help patients maintain healthy smiles.',
    icon: ShieldCheck,
  },
]
