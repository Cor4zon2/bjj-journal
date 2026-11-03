// Friendly names for the types generated from the backend's OpenAPI schema (`npm run gen:api`).
import type { components } from './schema'

type Schemas = components['schemas']

export type Position = Schemas['PositionRead']
export type PositionRef = Schemas['PositionRef']
export type TechniqueSummary = Schemas['TechniqueSummary']
export type Technique = Schemas['TechniqueDetail']
export type TechniqueRef = Schemas['TechniqueRef']
export type TechniqueUpdate = Schemas['TechniqueUpdate']
export type TechniqueType = Technique['type']
export type Stat = Technique['stat']
export type VideoLink = Schemas['VideoLinkRead']
export type VideoLinkCreate = Schemas['VideoLinkCreate']
export type CommonMistake = Schemas['CommonMistakeRead']
export type Health = Schemas['HealthResponse']

export type TechniqueFilters = {
  position_id?: number
  type?: TechniqueType
  mastery?: number
  q?: string
}
