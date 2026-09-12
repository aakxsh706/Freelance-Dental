import type { LucideIcon } from 'lucide-react'
import { ImageIcon } from 'lucide-react'

interface ImagePlaceholderProps {
  label: string
  icon?: LucideIcon
  className?: string
}

/**
 * Stand-in for a real photograph. Swap the rendered element for an <img>
 * (or a CSS background-image) once the client provides actual clinic/dentist
 * photography — every call site passes a plain `className` for sizing, so no
 * layout changes are needed when the real image is dropped in.
 */
export function ImagePlaceholder({ label, icon: Icon = ImageIcon, className = '' }: ImagePlaceholderProps) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-2xl border border-(--color-border) bg-(--color-surface) ${className}`}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 55%), radial-gradient(circle at 75% 75%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 60%)',
        }}
      />
      <div className="relative flex flex-col items-center gap-3 px-6 text-center">
        <Icon className="h-10 w-10 text-(--color-accent)" strokeWidth={1.25} />
        <span className="text-xs font-medium uppercase tracking-[0.15em] text-(--color-ink-faint)">
          {label}
        </span>
      </div>
    </div>
  )
}
