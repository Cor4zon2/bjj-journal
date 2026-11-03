import type {
  Health,
  Position,
  Technique,
  TechniqueFilters,
  TechniqueSummary,
  TechniqueUpdate,
  VideoLink,
  VideoLinkCreate,
} from './types'

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Pull a readable message out of a FastAPI error body (`{detail: "..."}` or validation list). */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'detail' in body) {
      const { detail } = body as { detail: unknown }
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as { msg?: unknown }
        if (typeof first.msg === 'string') return first.msg
      }
    }
  } catch {
    // Not JSON; fall through.
  }
  return `API returned ${response.status}`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response))
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function getHealth(signal?: AbortSignal): Promise<Health> {
  return request('/health', { signal })
}

export function listPositions(signal?: AbortSignal): Promise<Position[]> {
  return request('/positions', { signal })
}

export function listTechniques(
  filters: TechniqueFilters = {},
  signal?: AbortSignal,
): Promise<TechniqueSummary[]> {
  return request(`/techniques${queryString(filters)}`, { signal })
}

export function getTechniqueBySlug(slug: string, signal?: AbortSignal): Promise<Technique> {
  return request(`/techniques/by-slug/${encodeURIComponent(slug)}`, { signal })
}

export function updateTechnique(id: number, changes: TechniqueUpdate): Promise<Technique> {
  return request(`/techniques/${id}`, { method: 'PATCH', body: JSON.stringify(changes) })
}

export function addVideo(techniqueId: number, video: VideoLinkCreate): Promise<VideoLink> {
  return request(`/techniques/${techniqueId}/videos`, {
    method: 'POST',
    body: JSON.stringify(video),
  })
}

export function deleteVideo(videoId: number): Promise<void> {
  return request(`/videos/${videoId}`, { method: 'DELETE' })
}
