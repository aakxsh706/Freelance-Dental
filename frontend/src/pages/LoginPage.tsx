import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { getCurrentStaff } from '../api/staff'
import { ApiError } from '../api/client'
import { Button } from '../components/ui/Button'
import { useAuthStore } from '../stores/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, setTokens, setStaff } = useAuthStore()
  // ClinicRoute records where the user was going before being bounced here.
  const destination = (location.state as { from?: string } | null)?.from ?? '/clinic/dashboard'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={destination} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const tokens = await login(username, password)
      setTokens(tokens)
      // Load the role before navigating so the sidebar renders the correct
      // items on first paint rather than flashing and then filtering.
      try {
        setStaff(await getCurrentStaff())
      } catch {
        // A valid login without a staff profile still reaches the app, where
        // ClinicRoute handles it; failing to read the role is not a login error.
      }
      navigate(destination)
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Incorrect username or password. Please try again.'
          : 'Unable to sign in right now. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-surface) px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-(--color-border) bg-(--color-bg) p-8 shadow-sm">
        <Link
          to="/"
          className="mb-8 block text-center font-display text-lg font-semibold text-(--color-ink)"
        >
          Dr. Belin&rsquo;s Dentistry
        </Link>
        <h1 className="mb-1 text-center text-xl font-semibold text-(--color-ink)">
          Dentist Login
        </h1>
        <p className="mb-6 text-center text-sm text-(--color-ink-soft)">
          Sign in to the clinic management software.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="username" className="text-sm font-medium text-(--color-ink)">
              Username
            </label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-lg border border-(--color-border) bg-(--color-bg) px-4 py-3 text-sm outline-none focus:border-(--color-accent)"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium text-(--color-ink)">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-(--color-border) bg-(--color-bg) px-4 py-3 text-sm outline-none focus:border-(--color-accent)"
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-(--color-danger)">{error}</p>
          )}

          <Button type="submit" disabled={submitting} className="mt-2 w-full">
            {submitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
