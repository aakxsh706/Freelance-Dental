import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/** Shared loading/error/data plumbing for read-only API calls so every
 * section handles the loading / empty / error states consistently instead
 * of re-implementing them per component. */
export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null })

  const load = useCallback(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof ApiError ? err.message : 'Unable to load this right now.'
        setState({ data: null, loading: false, error: message })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => load(), [load])

  return { ...state, reload: load }
}
