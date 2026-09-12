import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export function DashboardLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const clear = useAuthStore((state) => state.clear)

  function handleLogout() {
    clear()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-(--color-surface)">
      <header className="border-b border-(--color-border) bg-(--color-bg)">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <div>
            <p className="font-display text-base font-semibold text-(--color-ink)">
              Belin&rsquo;s Dental Clinic
            </p>
            <p className="text-xs text-(--color-ink-faint)">Dentist Dashboard</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-full border border-(--color-border) px-4 py-2 text-sm font-medium text-(--color-ink-soft) hover:border-(--color-accent)/40 hover:text-(--color-accent)"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Log Out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10 sm:px-8">{children}</main>
    </div>
  )
}
