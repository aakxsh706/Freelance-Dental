import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthTokens } from '../types'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setTokens: (tokens: AuthTokens) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setTokens: (tokens) =>
        set({
          accessToken: tokens.access,
          refreshToken: tokens.refresh,
          isAuthenticated: true,
        }),
      clear: () => set({ accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    { name: 'belins-dentist-auth' },
  ),
)
