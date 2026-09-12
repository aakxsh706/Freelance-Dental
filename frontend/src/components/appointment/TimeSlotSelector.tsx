import { getAvailability } from '../../api/availability'
import { useFetch } from '../../hooks/useFetch'
import { formatTime12h } from '../../lib/format'
import { ToothMascot } from '../ui/ToothMascot'

interface TimeSlotSelectorProps {
  date: string
  selectedTime: string | null
  onSelectTime: (time: string) => void
}

export function TimeSlotSelector({ date, selectedTime, onSelectTime }: TimeSlotSelectorProps) {
  const { data, loading, error, reload } = useFetch(() => getAvailability(date), [date])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-(--color-surface)" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-(--color-border) bg-(--color-surface) p-6 text-center">
        <p className="text-sm text-(--color-ink-soft)">
          We couldn&rsquo;t load available times. Please try again.
        </p>
        <button onClick={reload} className="text-sm font-medium text-(--color-accent) hover:underline">
          Retry
        </button>
      </div>
    )
  }

  const slots = data?.slots ?? []

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-(--color-border) bg-(--color-surface) p-6 text-center">
        <ToothMascot type="happy" size="sm" animated={false} />
        <p className="text-sm font-medium text-(--color-ink)">No appointments available</p>
        <p className="text-sm text-(--color-ink-soft)">
          There are no available appointments for this date. Please select another date or
          contact the clinic.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {slots.map((slot) => {
        const isBooked = slot.status === 'booked'
        const isSelected = selectedTime === slot.time
        return (
          <button
            key={slot.time}
            disabled={isBooked}
            onClick={() => onSelectTime(slot.time)}
            aria-pressed={isSelected}
            className={`rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
              isBooked
                ? 'cursor-not-allowed border-(--color-border) bg-(--color-surface) text-(--color-ink-faint) line-through'
                : isSelected
                  ? 'border-(--color-accent) bg-(--color-accent) text-white'
                  : 'border-(--color-border) bg-(--color-bg) text-(--color-ink) hover:border-(--color-accent)/50'
            }`}
          >
            {formatTime12h(slot.time)}
          </button>
        )
      })}
    </div>
  )
}
