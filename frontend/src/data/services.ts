import type { LucideIcon } from 'lucide-react'
import {
  Anchor,
  Baby,
  Hammer,
  Heart,
  Layers,
  Scissors,
  Smile,
  SmilePlus,
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
    title: 'Teeth Cleaning (Scaling)',
    description:
      'Scaling is a professional cleaning that removes plaque and hardened tartar from your teeth and along the gum line, helping keep your teeth and gums healthy.',
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
    title: 'Root Canal',
    description:
      'A root canal treats an infected or badly damaged tooth by removing the infection from inside the tooth and protecting it so the tooth can be preserved.',
    icon: Heart,
  },
  {
    title: 'Dental Crown + Bridges',
    description:
      'Crowns help protect and restore damaged or weakened teeth. Bridges replace one or more missing teeth by supporting a replacement tooth with nearby teeth.',
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
  {
    title: 'Implants',
    description:
      'Dental implants are replacement tooth roots that support a natural-looking artificial tooth, helping restore both function and appearance.',
    icon: Anchor,
  },
  {
    title: 'Orthobraces + Aligners, Invisalign',
    description:
      'Braces and clear aligners gradually move teeth into better alignment, helping improve your bite and create a straighter, healthier-looking smile.',
    icon: SmilePlus,
  },
  {
    title: 'Denture',
    description:
      'Dentures are removable dental appliances used to replace several missing teeth or a complete set of teeth, helping restore your smile and everyday function.',
    icon: Layers,
  },
]
