// Scroll-progress thresholds (0-1) for the Happy → Superhero crossfade.
// Below HAPPY_TOOTH_END the Happy Tooth is fully opaque; above
// SUPERHERO_TOOTH_START the Superhero Tooth is fully opaque; between the two
// they crossfade linearly.
export const HAPPY_TOOTH_END = 0.4
export const SUPERHERO_TOOTH_START = 0.6

// Decorative floss nodes, as scroll-progress fractions (0-1) — purely
// visual, never clickable, kept to a handful so it still reads as floss
// rather than a stepper/timeline.
export const FLOSS_NODES: number[] = [0.2, 0.45, 0.7, 0.9]
