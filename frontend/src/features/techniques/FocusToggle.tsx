import { useProfile, useUpdateProfile } from '../../api/queries'
import type { Technique } from '../../api/types'
import { ErrorMessage } from '../../components/ui'

export const MAX_FOCUS = 5

/** Adds the technique to, or removes it from, the "Current focus" list on Home. */
export function FocusToggle({ technique }: { technique: Technique }) {
  const profile = useProfile()
  const update = useUpdateProfile()

  if (!profile.data) return null
  const ids = profile.data.focus_technique_ids
  const focused = ids.includes(technique.id)
  const full = !focused && ids.length >= MAX_FOCUS

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        aria-pressed={focused}
        disabled={update.isPending || full}
        onClick={() =>
          update.mutate({
            focus_technique_ids: focused
              ? ids.filter((id) => id !== technique.id)
              : [...ids, technique.id],
          })
        }
        className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${
          focused ? 'bg-sky-500/20 text-sky-200' : 'bg-slate-800 text-slate-200'
        }`}
      >
        {focused ? '★ Focus' : '☆ Focus'}
      </button>
      {full && (
        <p className="text-xs text-slate-500">
          You already focus on {MAX_FOCUS} techniques. Remove one first.
        </p>
      )}
      {update.isError && <ErrorMessage error={update.error} />}
    </div>
  )
}
