import type { AppointmentStatus } from '../../types'
import { statusLabels } from '../../lib/format'

const statusClasses: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-(--color-accent-soft) text-(--color-accent) border-(--color-accent)/30',
  completed: 'bg-slate-100 text-slate-600 border-slate-200',
  cancelled: 'bg-red-50 text-(--color-danger) border-red-200',
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  )
}
