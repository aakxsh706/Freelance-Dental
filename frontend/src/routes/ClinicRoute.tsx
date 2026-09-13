import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getCurrentStaff } from '../api/staff'
import { useAuthStore } from '../stores/authStore'
import type { StaffProfile } from '../types/clinic'

interface ClinicRouteProps {
  children: ReactNode
  /** Optional capability gate. The server enforces this too; checking here
   * only avoids routing someone to a page that would refuse to load. */
  requires?: keyof Pick<
    StaffProfile,
    'can_view_clinical' | 'can_edit_clinical' | 'can_prescribe' | 'can_manage_settings' | 'can_view_audit'
  >
}

export function ClinicRoute({ children, requires }: ClinicRouteProps) {
  const location = useLocation()
  const { isAuthenticated, staff, setStaff, clear } = useAuthStore()

  // "Signed in but no profile loaded yet" is itself the loading state, so no
  // separate loading flag is needed.
  const needsProfile = isAuthenticated && !staff

  useEffect(() => {
    if (!needsProfile) return
    let cancelled = false
    getCurrentStaff()
      .then((profile) => {
        if (!cancelled) setStaff(profile)
      })
      .catch(() => {
        // A valid token without a staff profile is not a clinic session;
        // clearing it sends the user back to sign-in.
        if (!cancelled) clear()
      })
    return () => {
      cancelled = true
    }
  }, [needsProfile, setStaff, clear])

  if (!isAuthenticated) {
    // Remember where they were headed so sign-in can return them to it.
    return <Navigate to="/clinic/login" replace state={{ from: location.pathname }} />
  }

  if (!staff) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-(--color-ink-soft)">
        Loading your clinic session…
      </div>
    )
  }

  if (requires && !staff[requires]) {
    return <Navigate to="/clinic/dashboard" replace />
  }

  return <>{children}</>
}
