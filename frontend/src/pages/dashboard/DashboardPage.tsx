import { useState } from 'react'
import { getDentistProfile } from '../../api/dentist'
import { AppointmentsList } from '../../components/dashboard/AppointmentsList'
import { AvailabilityManager } from '../../components/dashboard/AvailabilityManager'
import { NotificationsPanel } from '../../components/dashboard/NotificationsPanel'
import { StatsOverview } from '../../components/dashboard/StatsOverview'
import { ToothMascot } from '../../components/ui/ToothMascot'
import { fallbackDentist } from '../../data/clinicConfig'
import { useFetch } from '../../hooks/useFetch'

type Tab = 'appointments' | 'availability'

function timeOfDayGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const [tab, setTab] = useState<Tab>('appointments')
  const { data: dentist } = useFetch(getDentistProfile, [])
  const dentistName = (dentist ?? fallbackDentist).name

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <ToothMascot type="superhero" size="sm" animated={false} />
        <div>
          <h1 className="text-2xl font-semibold text-(--color-ink)">
            {timeOfDayGreeting()}, {dentistName}
          </h1>
          <p className="text-sm text-(--color-ink-soft)">
            Manage appointment requests and clinic availability.
          </p>
        </div>
      </div>

      <NotificationsPanel />
      <StatsOverview />

      <div className="flex gap-2 border-b border-(--color-border)">
        {(
          [
            { key: 'appointments', label: 'Appointments' },
            { key: 'availability', label: 'Availability' },
          ] as { key: Tab; label: string }[]
        ).map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === item.key
                ? 'border-(--color-accent) text-(--color-accent)'
                : 'border-transparent text-(--color-ink-soft) hover:text-(--color-ink)'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'appointments' ? <AppointmentsList /> : <AvailabilityManager />}
    </div>
  )
}
