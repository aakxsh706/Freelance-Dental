import {
  Activity,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  ScrollText,
  Settings,
  Stethoscope,
  Users,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import type { StaffProfile } from '../../types/clinic'

type Capability = keyof Pick<
  StaffProfile,
  'can_view_clinical' | 'can_prescribe' | 'can_manage_settings' | 'can_view_audit'
>

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  /** Hidden when the signed-in role lacks this capability. */
  requires?: Capability
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/clinic/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clinic/appointments', label: 'Appointments', icon: ClipboardList },
  { to: '/clinic/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/clinic/patients', label: 'Patients', icon: Users },
  { to: '/clinic/visits', label: 'Clinical Records', icon: Stethoscope, requires: 'can_view_clinical' },
  { to: '/clinic/prescriptions', label: 'Prescriptions', icon: Pill, requires: 'can_prescribe' },
  { to: '/clinic/audit', label: 'Audit Trail', icon: ScrollText, requires: 'can_view_audit' },
  { to: '/clinic/settings', label: 'Settings', icon: Settings },
]

/**
 * Shell for the internal clinic software.
 *
 * Operational software, not a marketing page: a persistent sidebar so the same
 * destination is always in the same place, high information density, and no
 * animation that would slow down a repeated task.
 */
export function ClinicLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { staff, clear } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleLogout() {
    clear()
    navigate('/clinic/login')
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.requires || !staff || staff[item.requires],
  )

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {visibleItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-(--color-accent) text-white'
                  : 'text-(--color-ink-soft) hover:bg-(--color-accent-soft) hover:text-(--color-accent)'
              }`
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )

  const sidebarBody = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-2.5 px-2 pt-2">
        <Activity className="h-5 w-5 text-(--color-accent)" strokeWidth={2} />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-(--color-ink)">
            Belin&rsquo;s Dental Clinic
          </p>
          <p className="text-xs text-(--color-ink-faint)">Clinic Management</p>
        </div>
      </div>

      {nav}

      <div className="border-t border-(--color-border) pt-4">
        {staff && (
          <div className="mb-3 px-3">
            <p className="truncate text-sm font-medium text-(--color-ink)">
              {staff.full_name || staff.username}
            </p>
            <p className="text-xs text-(--color-ink-faint)">{staff.role_display}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-(--color-ink-soft) transition-colors hover:bg-red-50 hover:text-(--color-danger)"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
          Log Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-(--color-surface)">
      {/* Desktop-first: the sidebar is always present from lg upward. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-(--color-border) bg-(--color-bg) lg:block">
        {sidebarBody}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-(--color-ink)/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-(--color-border) bg-(--color-bg)">
            <button
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-(--color-ink-soft) hover:bg-(--color-surface)"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarBody}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-(--color-border) bg-(--color-bg)/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-(--color-ink-soft) hover:bg-(--color-surface)"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="font-display text-sm font-semibold text-(--color-ink)">
            Belin&rsquo;s Dental Clinic
          </p>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
