import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addVideo,
  deleteVideo,
  getTechniqueBySlug,
  listPositions,
  listTechniques,
  updateTechnique,
} from './client'
import type { Technique, TechniqueFilters, TechniqueUpdate, VideoLinkCreate } from './types'

export const queryKeys = {
  positions: ['positions'] as const,
  techniques: ['techniques'] as const,
  techniqueList: (filters: TechniqueFilters) => ['techniques', 'list', filters] as const,
  technique: (slug: string) => ['techniques', 'detail', slug] as const,
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
