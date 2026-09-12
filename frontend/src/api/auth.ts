import type { AuthTokens } from '../types'
import { apiRequest } from './client'

export function login(username: string, password: string) {
  return apiRequest<AuthTokens>('/auth/login/', {
    method: 'POST',
    body: { username, password },
  })
}
