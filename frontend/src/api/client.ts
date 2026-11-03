import { supabase } from '../lib/supabase'

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`API returned ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

export type Health = {
  status: 'ok'
  version: string
}

export type Me = {
  id: string
  email: string | null
}

/** Fetch from the API, attaching the current Supabase access token when signed in. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (supabase) {
    // getSession() refreshes an expired access token before handing it out.
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (!response.ok) {
    throw new ApiError(response.status)
  }
  return (await response.json()) as T
}

export function getHealth(signal?: AbortSignal): Promise<Health> {
  return apiFetch<Health>('/health', { signal })
}

export function getMe(signal?: AbortSignal): Promise<Me> {
  return apiFetch<Me>('/me', { signal })
}
