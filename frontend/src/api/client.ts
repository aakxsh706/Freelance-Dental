import { useAuthStore } from '../stores/authStore'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:4545/api'

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
}

function extractMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Something went wrong. Please try again.'
  const values = Object.values(body as Record<string, unknown>)
  const first = values[0]
  if (Array.isArray(first) && typeof first[0] === 'string') return first[0]
  if (typeof first === 'string') return first
  return 'Something went wrong. Please try again.'
}

async function rawRequest(path: string, options: RequestOptions, accessToken: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  return response
}

/** Fetch wrapper that attaches the dentist's JWT and transparently refreshes
 * it once on a 401 before giving up — keeps the dashboard session alive
 * without every call site re-implementing refresh logic. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken, refreshToken, setTokens, clear } = useAuthStore.getState()

  let response = await rawRequest(path, options, accessToken)

  if (response.status === 401 && options.auth && refreshToken) {
    const refreshed = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    })
    if (refreshed.ok) {
      const data = (await refreshed.json()) as { access: string }
      setTokens({ access: data.access, refresh: refreshToken })
      response = await rawRequest(path, options, data.access)
    } else {
      clear()
    }
  }

  if (!response.ok) {
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // no JSON body
    }
    throw new ApiError(extractMessage(body), response.status, body)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
