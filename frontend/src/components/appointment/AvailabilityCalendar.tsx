import { addDaysIso, todayIso } from '../../lib/format'

interface AvailabilityCalendarProps {
  selectedDate: string
  onSelectDate: (date: string) => void
  daysAhead?: number
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Quick-pick strip for the next N days plus a native date input for
 * jumping further out. A native <input type="date"> keeps this accessible
 * and works well on mobile without a heavy calendar-grid dependency. */
export function AvailabilityCalendar({
  selectedDate,
  onSelectDate,
  daysAhead = 14,
}: AvailabilityCalendarProps) {
  const today = todayIso()
  const days = Array.from({ length: daysAhead }, (_, i) => addDaysIso(today, i))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((date) => {
          const [year, month, day] = date.split('-').map(Number)
          const weekday = new Date(year, month - 1, day).getDay()
          const isSelected = date === selectedDate
          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`flex min-w-16 flex-none flex-col items-center gap-1 rounded-xl border px-3 py-3 transition-colors ${
                isSelected
                  ? 'border-(--color-accent) bg-(--color-accent) text-white'
                  : 'border-(--color-border) bg-(--color-bg) text-(--color-ink) hover:border-(--color-accent)/50'
              }`}
            >
              <span className="text-xs font-medium uppercase opacity-80">
                {WEEKDAY_LABELS[weekday]}
              </span>
              <span className="text-lg font-semibold">{day}</span>
            </button>
          )
        })}
      </div>

      <label className="flex items-center gap-3 text-sm text-(--color-ink-soft)">
        Or pick any date:
        <input
          type="date"
          min={today}
          value={selectedDate}
          onChange={(e) => onSelectDate(e.target.value)}
          className="rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm outline-none focus:border-(--color-accent)"
        />
      </label>
    </div>
  )
}
