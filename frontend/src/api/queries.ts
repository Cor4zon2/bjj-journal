import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addVideo,
  createSession,
  deleteMistake,
  deleteSession,
  deleteVideo,
  getSession,
  listMistakes,
  listSessions,
  updateMistake,
  updateSession,
  getTechniqueBySlug,
  listPositions,
  listTechniques,
  updateTechnique,
} from './client'
import type {
  ClassSessionCreate,
  ClassSessionUpdate,
  MistakeUpdate,
  Technique,
  TechniqueFilters,
  TechniqueUpdate,
  VideoLinkCreate,
} from './types'

export const queryKeys = {
  positions: ['positions'] as const,
  techniques: ['techniques'] as const,
  techniqueList: (filters: TechniqueFilters) => ['techniques', 'list', filters] as const,
  technique: (slug: string) => ['techniques', 'detail', slug] as const,
  sessions: ['sessions'] as const,
  session: (id: number) => ['sessions', id] as const,
  mistakes: ['mistakes'] as const,
}

export function usePositions() {
  return useQuery({
    queryKey: queryKeys.positions,
    queryFn: ({ signal }) => listPositions(signal),
    staleTime: 5 * 60_000,
  })
}

export function useTechniques(filters: TechniqueFilters) {
  return useQuery({
    queryKey: queryKeys.techniqueList(filters),
    queryFn: ({ signal }) => listTechniques(filters, signal),
    placeholderData: keepPreviousData,
  })
}

export function useTechnique(slug: string) {
  return useQuery({
    queryKey: queryKeys.technique(slug),
    queryFn: ({ signal }) => getTechniqueBySlug(slug, signal),
  })
}

/** Saves a partial update and refreshes the technique page and lists. */
export function useUpdateTechnique(technique: Technique) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: TechniqueUpdate) => updateTechnique(technique.id, changes),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.technique(updated.slug), updated)
      void queryClient.invalidateQueries({ queryKey: ['techniques', 'list'] })
    },
  })
}

export function useAddVideo(technique: Technique) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (video: VideoLinkCreate) => addVideo(technique.id, video),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.technique(technique.slug) }),
  })
}

export function useDeleteVideo(technique: Technique) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (videoId: number) => deleteVideo(videoId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.technique(technique.slug) }),
  })
}

// ---- Class log ----------------------------------------------------------------

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: ({ signal }) => listSessions(signal),
  })
}

export function useSession(id: number) {
  return useQuery({
    queryKey: queryKeys.session(id),
    queryFn: ({ signal }) => getSession(id, signal),
  })
}

/** A class changes the history, the mistakes list and techniques' "times hit". */
function useInvalidateLog() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.mistakes }),
      queryClient.invalidateQueries({ queryKey: queryKeys.techniques }),
    ])
}

export function useCreateSession() {
  const invalidate = useInvalidateLog()
  return useMutation({
    mutationFn: (body: ClassSessionCreate) => createSession(body),
    // Fail fast with no signal instead of pausing silently: the page keeps the draft,
    // tells the user, and re-sends it when the phone is back online.
    networkMode: 'always',
    onSuccess: () => invalidate(),
  })
}

export function useUpdateSession(id: number) {
  const invalidate = useInvalidateLog()
  return useMutation({
    mutationFn: (changes: ClassSessionUpdate) => updateSession(id, changes),
    networkMode: 'always',
    onSuccess: () => invalidate(),
  })
}

export function useDeleteSession() {
  const invalidate = useInvalidateLog()
  return useMutation({
    mutationFn: (id: number) => deleteSession(id),
    onSuccess: () => invalidate(),
  })
}

// ---- My mistakes --------------------------------------------------------------

export function useMistakes() {
  return useQuery({
    queryKey: queryKeys.mistakes,
    queryFn: ({ signal }) => listMistakes(signal),
  })
}

export function useUpdateMistake() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: MistakeUpdate }) =>
      updateMistake(id, changes),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.mistakes }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
      ]),
  })
}

export function useDeleteMistake() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteMistake(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.mistakes }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
      ]),
  })
}
