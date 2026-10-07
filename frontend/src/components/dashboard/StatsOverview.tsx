import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getDashboardStats } from '../../api/dentist'
import { useFetch } from '../../hooks/useFetch'
import { statusLabels } from '../../lib/format'
import type { AppointmentStatus } from '../../types'

const statusOrder: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'cancelled']

export function StatsOverview() {
  const { data, loading, error } = useFetch(getDashboardStats, [])

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-(--color-bg)" />
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-(--color-border) bg-(--color-bg) p-6 text-sm text-(--color-ink-soft)">
        Dashboard summary is unavailable right now.
      </div>
    )
  }

  const chartData = data.last_7_days.map((point) => ({
    label: point.date.slice(5),
    count: point.count,
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 rounded-xl border border-(--color-border) bg-(--color-bg) p-6 lg:col-span-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-(--color-ink-faint)">
          Today
        </p>
        <p className="text-4xl font-semibold text-(--color-ink)">{data.today_count}</p>
        <p className="text-sm text-(--color-ink-soft)">appointments scheduled today</p>

        <div className="mt-2 flex flex-col gap-2 border-t border-(--color-border) pt-4">
          {statusOrder.map((status) => (
            <div key={status} className="flex items-center justify-between text-sm">
              <span className="text-(--color-ink-soft)">{statusLabels[status]}</span>
              <span className="font-medium text-(--color-ink)">{data.by_status[status]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-(--color-border) bg-(--color-bg) p-6 lg:col-span-2">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-(--color-ink-faint)">
          Appointments — last 7 days
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'var(--color-ink-faint)' }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={24}
              tick={{ fontSize: 12, fill: 'var(--color-ink-faint)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-surface)' }}
              contentStyle={{ borderRadius: 8, borderColor: 'var(--color-border)', fontSize: 12 }}
            />
            <Bar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
