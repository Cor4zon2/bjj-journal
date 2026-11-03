import type { Stat, TechniqueType } from '../api/types'

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
