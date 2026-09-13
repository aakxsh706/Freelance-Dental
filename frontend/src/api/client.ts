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
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  auth?: boolean
}

/** Build a query string, dropping empty values so callers can pass their whole
 * filter state without pruning it first. */
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }
  const encoded = query.toString()
  return encoded ? `?${encoded}` : ''
}

function extractMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Something went wrong. Please try again.'
  const record = body as Record<string, unknown>
  // DRF puts permission and auth failures under `detail`; showing that verbatim
  // is far more useful than a generic message, because it says which role is
  // required.
  if (typeof record.detail === 'string') return record.detail
  const values = Object.values(record)
  const first = values[0]
  if (Array.isArray(first) && typeof first[0] === 'string') return first[0]
  if (typeof first === 'string') return first
  return 'Something went wrong. Please try again.'
}

/** Field-level errors from a DRF 400, for rendering next to inputs. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 400) return {}
  const body = error.body
  if (!body || typeof body !== 'object') return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (Array.isArray(value) && typeof value[0] === 'string') result[key] = value[0]
    else if (typeof value === 'string') result[key] = value
  }
  return result
}

async function rawRequest(path: string, options: RequestOptions, accessToken: string | null) {
  const isFormData = options.body instanceof FormData
  // The browser must set its own multipart boundary, so Content-Type is left
  // off entirely for uploads rather than set to multipart/form-data.
  const headers: Record<string, string> = isFormData
    ? {}
    : { 'Content-Type': 'application/json' }
  if (options.auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: isFormData
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
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
