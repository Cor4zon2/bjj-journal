import { MAX_MASTERY, masteryName } from '../lib/labels'

/** Five small pips, filled up to the mastery level. */
export function MasteryPips({ level, size = 'sm' }: { level: number; size?: 'sm' | 'md' }) {
  const pip = size === 'md' ? 'h-2.5 w-6' : 'h-1.5 w-4'
  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={`Mastery ${level} of ${MAX_MASTERY}: ${masteryName(level)}`}
    >
      {Array.from({ length: MAX_MASTERY }, (_, i) => (
        <span
          key={i}
          className={`${pip} rounded-full ${i < level ? 'bg-amber-400' : 'bg-slate-700'}`}
        />
      ))}
    </span>
  )
}
