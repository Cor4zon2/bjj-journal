import type {
  ClassType,
  MistakeCategory,
  MistakeStatus,
  SessionTechniqueKind,
  Stat,
  TechniqueType,
} from '../api/types'

export const MASTERY_LEVELS = [
  { level: 0, name: 'Locked', hint: 'Prerequisites not yet drilled' },
  { level: 1, name: 'Seen', hint: 'Shown in class or watched' },
  { level: 2, name: 'Drilled', hint: 'Drilled with a cooperative partner' },
  { level: 3, name: 'Hit in rolling', hint: 'Landed it in sparring at least once' },
  { level: 4, name: 'Hit on resisting partners', hint: 'Landed it repeatedly against resistance' },
  { level: 5, name: 'Mastered', hint: 'Reliable; can teach it' },
] as const

export const MAX_MASTERY = 5

export const TECHNIQUE_TYPES: { value: TechniqueType; label: string }[] = [
  { value: 'pull', label: 'Guard pull' },
  { value: 'sweep', label: 'Sweep' },
  { value: 'submission', label: 'Submission' },
  { value: 'pass', label: 'Pass' },
  { value: 'escape', label: 'Escape' },
  { value: 'takedown', label: 'Takedown' },
  { value: 'entry', label: 'Entry' },
  { value: 'control', label: 'Control' },
]

export const STAT_LABELS: Record<Stat, string> = {
  guard: 'Guard',
  sweeps: 'Sweeps',
  passing: 'Passing',
  escapes: 'Escapes',
  submissions: 'Submissions',
  takedowns: 'Takedowns',
}

export function typeLabel(type: TechniqueType): string {
  return TECHNIQUE_TYPES.find((t) => t.value === type)?.label ?? type
}

export function masteryName(level: number): string {
  return MASTERY_LEVELS[level]?.name ?? `Level ${level}`
}

export const CLASS_TYPES: { value: ClassType; label: string }[] = [
  { value: 'gi_class', label: 'Gi class' },
  { value: 'open_mat', label: 'Open mat' },
  { value: 'drilling', label: 'Drilling' },
  { value: 'competition', label: 'Competition' },
]

export const TECHNIQUE_KINDS: { value: SessionTechniqueKind; label: string }[] = [
  { value: 'taught', label: 'Taught' },
  { value: 'drilled', label: 'Drilled' },
  { value: 'hit_in_rolling', label: 'Hit' },
]

export const KIND_LABELS: Record<SessionTechniqueKind, string> = {
  taught: 'Taught',
  drilled: 'Drilled',
  hit_in_rolling: 'Hit in rolling',
}

export const MISTAKE_CATEGORIES: { value: MistakeCategory; label: string }[] = [
  { value: 'posture', label: 'Posture' },
  { value: 'grips', label: 'Grips' },
  { value: 'timing', label: 'Timing' },
  { value: 'hook_retention', label: 'Hook retention' },
  { value: 'defense', label: 'Defense' },
  { value: 'other', label: 'Other' },
]

export const MISTAKE_STATUSES: { value: MistakeStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'working', label: 'Working on it' },
  { value: 'fixed', label: 'Fixed' },
]

export const ENERGY_LABELS = ['Drained', 'Tired', 'OK', 'Good', 'Great'] as const

export function classTypeLabel(type: ClassType): string {
  return CLASS_TYPES.find((t) => t.value === type)?.label ?? type
}

export function categoryLabel(category: MistakeCategory): string {
  return MISTAKE_CATEGORIES.find((c) => c.value === category)?.label ?? category
}

export function statusLabel(status: MistakeStatus): string {
  return MISTAKE_STATUSES.find((s) => s.value === status)?.label ?? status
}

/** "Sun 2 Nov" for a `YYYY-MM-DD` date, without timezone shifts. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Today's local date as `YYYY-MM-DD`. */
export function today(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
