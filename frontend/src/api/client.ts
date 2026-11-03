export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type Health = {
  status: 'ok'
  version: string
}

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const response = await fetch(`${API_URL}/health`, { signal })
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`)
  }
  return (await response.json()) as Health
}
