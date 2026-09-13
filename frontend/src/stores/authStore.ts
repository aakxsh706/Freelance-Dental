import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthTokens } from '../types'
import type { StaffProfile } from '../types/clinic'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  /** Role and capabilities, loaded after sign-in. Null until /auth/me/ returns.
   *
   * Held here only to decide what the interface offers - every endpoint
   * re-checks the role server-side, so a tampered value in storage grants
   * nothing. */
  staff: StaffProfile | null
  setTokens: (tokens: AuthTokens) => void
  setStaff: (staff: StaffProfile | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      staff: null,
      setTokens: (tokens) =>
        set({
          accessToken: tokens.access,
          refreshToken: tokens.refresh,
          isAuthenticated: true,
        }),
      setStaff: (staff) => set({ staff }),
      clear: () =>
        set({ accessToken: null, refreshToken: null, isAuthenticated: false, staff: null }),
    }),
    { name: 'belins-dentist-auth' },
  ),
)
