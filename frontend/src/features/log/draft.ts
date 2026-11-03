import type {
  ClassSession,
  ClassSessionCreate,
  ClassType,
  MistakeCategory,
  MistakeStatus,
  SessionTechniqueKind,
} from '../../api/types'
import { today } from '../../lib/labels'
import { readJson, removeKey, writeJson } from '../../lib/storage'

export type DraftTechnique = {
  technique_id: number
  /** Kept in the draft so a restored log reads fine before the technique list loads. */
  name: string
  kinds: SessionTechniqueKind[]
}

export type DraftMistake = {
  /** Stable React key; also survives a reload of the draft. */
  key: string
  /** Set when editing a mistake that is already saved. */
  id?: number
  description: string
  category: MistakeCategory
  technique_id: number | null
  position_id: number | null
  status: MistakeStatus
}

export type LogDraft = {
  /** Sent with the save so a retry after losing signal never logs the class twice. */
  client_id: string
  date: string
  type: ClassType
  duration_min: number | null
  energy: number | null
  rolling_notes: string
  techniques: DraftTechnique[]
  mistakes: DraftMistake[]
  /** When the draft was last changed on this device (ISO timestamp). */
  updated_at?: string
}

export const DRAFT_KEY = 'bjj-journal:log-draft'

export function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function emptyDraft(): LogDraft {
  return {
    client_id: randomId(),
    date: today(),
    type: 'gi_class',
    duration_min: null,
    energy: null,
    rolling_notes: '',
    techniques: [],
    mistakes: [],
  }
}

export function emptyMistake(technique_id: number | null = null): DraftMistake {
  return {
    key: randomId(),
    description: '',
    category: 'other',
    technique_id,
    position_id: null,
    status: 'open',
  }
}

export function loadDraft(): LogDraft | null {
  const draft = readJson<LogDraft>(DRAFT_KEY)
  if (!draft || typeof draft !== 'object' || !Array.isArray(draft.techniques)) return null
  return draft
}

export function saveDraft(draft: LogDraft): void {
  writeJson(DRAFT_KEY, { ...draft, updated_at: new Date().toISOString() })
}

export function clearDraft(): void {
  removeKey(DRAFT_KEY)
}

/** The parts of the draft the API needs. Blank mistakes and techniques with no kind are dropped. */
export function toPayload(draft: LogDraft): Omit<ClassSessionCreate, 'client_id'> {
  return {
    date: draft.date,
    type: draft.type,
    duration_min: draft.duration_min,
    energy: draft.energy,
    rolling_notes: draft.rolling_notes.trim(),
    techniques: draft.techniques.flatMap((t) =>
      t.kinds.map((kind) => ({ technique_id: t.technique_id, kind })),
    ),
    mistakes: draft.mistakes
      .filter((m) => m.description.trim())
      .map((m) => ({
        id: m.id ?? null,
        description: m.description.trim(),
        category: m.category,
        technique_id: m.technique_id,
        position_id: m.position_id,
        status: m.status,
      })),
  }
}

/** Turn a saved class back into a form draft, for editing. */
export function fromSession(session: ClassSession): LogDraft {
  const techniques = new Map<number, DraftTechnique>()
  for (const row of session.techniques) {
    const entry = techniques.get(row.technique_id) ?? {
      technique_id: row.technique_id,
      name: row.technique.name,
      kinds: [],
    }
    entry.kinds.push(row.kind)
    techniques.set(row.technique_id, entry)
  }
  return {
    client_id: session.client_id ?? '',
    date: session.date,
    type: session.type,
    duration_min: session.duration_min,
    energy: session.energy,
    rolling_notes: session.rolling_notes,
    techniques: [...techniques.values()],
    mistakes: session.mistakes.map((m) => ({
      key: `saved-${m.id}`,
      id: m.id,
      description: m.description,
      category: m.category,
      technique_id: m.technique_id,
      position_id: m.position_id,
      status: m.status,
    })),
  }
}
