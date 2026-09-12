import { mascots, type MascotType } from '../../data/mascots'

type MascotSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type MascotFrame = 'badge' | 'card' | 'plain' | 'standing'

interface ToothMascotProps {
  type: MascotType
  size?: MascotSize
  /** 'badge' = small white circular sticker (empty states, dashboard);
   * 'card' = large rounded rectangle on a white background (the hero's
   * primary visual); 'plain' = bare original image on a matching white/
   * near-white surface (confirmation screen); 'standing' = large
   * background-removed cutout that can stand on any section background,
   * beside or behind cards, without a white box around it. */
  frame?: MascotFrame
  /** Gentle continuous float — disabled automatically under prefers-reduced-motion. */
  animated?: boolean
  /** Decorative accents (the common case) get alt="" so screen readers skip
   * them; set false + pass `alt` when the mascot conveys real information. */
  decorative?: boolean
  alt?: string
  className?: string
}

const badgeSizeClasses: Record<MascotSize, string> = {
  xs: 'h-9 w-9',
  sm: 'h-14 w-14',
  md: 'h-20 w-20',
  lg: 'h-28 w-28',
  xl: 'h-full w-full',
}

const badgePadding: Record<MascotSize, string> = {
  xs: 'p-1.5',
  sm: 'p-2.5',
  md: 'p-3',
  lg: 'p-4',
  xl: 'p-6',
}

// Full-character "standing" scale — responsive widths roughly following the
// mobile/tablet/desktop ranges a standing character needs to read as a
// character rather than an icon, without overpowering the section content.
const standingSizeClasses: Record<MascotSize, string> = {
  xs: 'w-24 sm:w-32 lg:w-40',
  sm: 'w-28 sm:w-36 lg:w-44',
  md: 'w-36 sm:w-44 lg:w-56',
  lg: 'w-40 sm:w-52 lg:w-72',
  xl: 'w-48 sm:w-64 lg:w-80',
}

export function ToothMascot({
  type,
  size = 'sm',
  frame = 'badge',
  animated = true,
  decorative = true,
  alt,
  className = '',
}: ToothMascotProps) {
  const mascot = mascots[type]
  const resolvedAlt = decorative ? '' : (alt ?? mascot.alt)

  if (frame === 'standing') {
    return (
      <span
        className={`mascot-float-wrap relative inline-block ${standingSizeClasses[size]} ${animated ? 'mascot-float' : ''} transition-transform duration-300 ease-out ${className}`}
      >
        <span
          aria-hidden
          className="absolute bottom-[6%] left-1/2 h-[10%] w-[62%] -translate-x-1/2 rounded-[50%] bg-black/10 blur-md"
        />
        <img
          src={mascot.cutout}
          alt={resolvedAlt}
          draggable={false}
          loading="lazy"
          className="relative h-auto w-full select-none object-contain"
        />
      </span>
    )
  }

  const image = (
    <img
      src={mascot.image}
      alt={resolvedAlt}
      draggable={false}
      loading="lazy"
      className="h-full w-full select-none object-contain"
    />
  )

  if (frame === 'plain') {
    return (
      <span
        className={`mascot-float-wrap inline-block ${animated ? 'mascot-float' : ''} ${badgeSizeClasses[size]} ${className}`}
      >
        {image}
      </span>
    )
  }

  if (frame === 'card') {
    return (
      <div
        className={`mascot-float-wrap flex items-center justify-center rounded-2xl border border-(--color-border) bg-white ${animated ? 'mascot-float' : ''} ${className}`}
      >
        <div className="flex h-full w-full items-center justify-center p-10 sm:p-14">{image}</div>
      </div>
    )
  }

  return (
    <span
      className={`mascot-float-wrap inline-flex flex-none items-center justify-center rounded-full border border-black/5 bg-white shadow-md transition-transform duration-300 hover:scale-[1.03] ${animated ? 'mascot-float' : ''} ${badgeSizeClasses[size]} ${badgePadding[size]} ${className}`}
    >
      {image}
    </span>
  )
}
