interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: SectionHeadingProps) {
  const alignClasses = align === 'center' ? 'text-center items-center mx-auto' : 'text-left'

  return (
    <div className={`flex max-w-2xl flex-col gap-4 ${alignClasses}`}>
      {eyebrow && (
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent)">
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl font-semibold text-(--color-ink) sm:text-4xl">{title}</h2>
      {description && (
        <p className="text-base leading-relaxed text-(--color-ink-soft)">{description}</p>
      )}
    </div>
  )
}
