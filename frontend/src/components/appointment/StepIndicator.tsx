const steps = ['Your Details', 'Choose a Time', 'Confirmation']

export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mx-auto flex max-w-md items-center gap-2 sm:gap-4">
      {steps.map((label, index) => {
        const step = index + 1
        const isActive = step === current
        const isDone = step < current
        return (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
            <span
              className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-semibold ${
                isActive
                  ? 'bg-(--color-accent) text-white'
                  : isDone
                    ? 'bg-(--color-accent-soft) text-(--color-accent)'
                    : 'bg-(--color-surface) text-(--color-ink-faint)'
              }`}
            >
              {step}
            </span>
            <span
              className={`hidden text-xs font-medium sm:block ${
                isActive ? 'text-(--color-ink)' : 'text-(--color-ink-faint)'
              }`}
            >
              {label}
            </span>
            {step < steps.length && <span className="h-px flex-1 bg-(--color-border)" />}
          </li>
        )
      })}
    </ol>
  )
}
