import type { UseQueryResult } from '@tanstack/react-query'
import { useEffect } from 'react'
import { readJson, writeJson } from '../../lib/storage'

/**
 * The last list the API returned, kept on the device so pickers keep working in a gym
 * with no signal. Returns the live data when there is some, else the stored copy.
 */
export function useOfflineList<T>(key: string, query: UseQueryResult<T[]>): T[] {
  const { data } = query
  useEffect(() => {
    if (data) writeJson(key, data)
  }, [key, data])
  return data ?? readJson<T[]>(key) ?? []
}
