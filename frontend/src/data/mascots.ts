import happyToothCutout from '../assets/tooth-mascot-happy-cutout.png'
import happyToothImage from '../assets/tooth-mascot-happy.jpg'
import superheroToothCutout from '../assets/tooth-mascot-superhero-cutout.png'
import superheroToothImage from '../assets/tooth-mascot-superhero.jpg'

export type MascotType = 'happy' | 'superhero'

interface MascotDefinition {
  /** Original supplied artwork (white background) — used for the 'card'
   * frame, where the surrounding container is white so the image blends
   * in seamlessly (e.g. the hero's "clinic photo" and the confirmation
   * screen). Pixels are untouched from what was supplied. */
  image: string
  /** Background-removed cutout of the same artwork — used for the 'standing'
   * frame so the character can be placed over any section background (tinted
   * cards, off-white, surface gray) without showing a white rectangle. */
  cutout: string
  alt: string
}

/**
 * Single source of truth for the two recurring mascot illustrations. If the
 * client supplies improved artwork later, swap the imports above only —
 * every <ToothMascot> across the site picks it up automatically.
 */
export const mascots: Record<MascotType, MascotDefinition> = {
  happy: {
    image: happyToothImage,
    cutout: happyToothCutout,
    alt: 'Friendly smiling tooth mascot giving a thumbs up',
  },
  superhero: {
    image: superheroToothImage,
    cutout: superheroToothCutout,
    alt: 'Superhero tooth mascot wearing a red cape',
  },
}
