import { useUpdateTechnique } from '../../api/queries'
import type { Technique } from '../../api/types'
import { ErrorMessage, Section } from '../../components/ui'
import { MASTERY_LEVELS } from '../../lib/labels'

export function MasteryPicker({ technique }: { technique: Technique }) {
  const update = useUpdateTechnique(technique)
  const pending = update.isPending ? update.variables.mastery : undefined
  const current = pending ?? technique.mastery
  const description = MASTERY_LEVELS[current]

  return (
    <Section title="Mastery">
      <div role="radiogroup" aria-label="Mastery level" className="grid grid-cols-6 gap-1.5">
        {MASTERY_LEVELS.map((level) => {
          const selected = level.level === current
          return (
            <button
              key={level.level}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${level.level}: ${level.name}`}
              disabled={update.isPending}
              onClick={() => {
                if (!selected) update.mutate({ mastery: level.level })
              }}
              className={`min-h-11 rounded-lg text-base font-semibold transition-colors ${
                selected
                  ? 'bg-amber-400 text-slate-950'
                  : level.level < current
                    ? 'bg-amber-400/25 text-amber-200'
                    : 'bg-slate-800 text-slate-400'
              }`}
            >
              {level.level}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-sm">
        <span className="font-semibold">{description.name}</span>
        <span className="text-slate-400"> — {description.hint}</span>
      </p>
      {update.isError && (
        <div className="mt-2">
          <ErrorMessage error={update.error} />
        </div>
      )}
    </Section>
  )
}
