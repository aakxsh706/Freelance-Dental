import type { AppointmentStatus } from '../../types'
import { statusLabels } from '../../lib/format'

const statusClasses: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-(--color-accent-soft) text-(--color-accent) border-(--color-accent)/30',
  // Checked in is the one status that means "happening right now", so it is
  // the only one that reads as live rather than settled.
  checked_in: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-slate-100 text-slate-600 border-slate-200',
  cancelled: 'bg-red-50 text-(--color-danger) border-red-200',
  no_show: 'bg-stone-100 text-stone-600 border-stone-300',
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${
        statusClasses[status] ?? statusClasses.pending
      }`}
    >
      {statusLabels[status] ?? status}
    </span>
  )
}
