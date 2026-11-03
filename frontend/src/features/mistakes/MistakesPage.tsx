import { Link, useSearchParams } from 'react-router'
import { useDeleteMistake, useMistakes, useUpdateMistake } from '../../api/queries'
import type { Mistake, MistakeStatus } from '../../api/types'
import { Badge, Button, ErrorMessage } from '../../components/ui'
import { MISTAKE_STATUSES, categoryLabel, classTypeLabel, formatDate } from '../../lib/labels'

type Filter = MistakeStatus | 'all'

const FILTERS: { value: Filter; label: string }[] = [
  ...MISTAKE_STATUSES,
  { value: 'all', label: 'All' },
]

const STATUS_STYLES: Record<MistakeStatus, string> = {
  open: 'border-red-400 bg-red-400 text-slate-950',
  working: 'border-amber-400 bg-amber-400 text-slate-950',
  fixed: 'border-emerald-400 bg-emerald-400 text-slate-950',
}

function isFilter(value: string | null): value is Filter {
  return FILTERS.some((f) => f.value === value)
}

export function MistakesPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('status')
  const filter: Filter = isFilter(raw) ? raw : 'open'
  const mistakes = useMistakes()

  const counts = new Map<Filter, number>([['all', mistakes.data?.length ?? 0]])
  for (const m of mistakes.data ?? []) counts.set(m.status, (counts.get(m.status) ?? 0) + 1)
  const shown = (mistakes.data ?? []).filter((m) => filter === 'all' || m.status === filter)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">My mistakes</h1>
        <p className="text-sm text-slate-400">Open → Working on it → Fixed.</p>
      </div>

      <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            aria-label={mistakes.data ? `${label} (${counts.get(value) ?? 0})` : label}
            onClick={() => setParams(value === 'open' ? {} : { status: value }, { replace: true })}
            className={`min-h-10 rounded-full px-3 text-sm font-medium ${
              filter === value ? 'bg-slate-100 text-slate-950' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {label}
            {mistakes.data && (
              <span className="ml-1 opacity-60" aria-hidden="true">
                {counts.get(value) ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {mistakes.isError ? (
        <ErrorMessage error={mistakes.error} />
      ) : mistakes.isPending ? (
        <p role="status" className="text-slate-400">
          Loading mistakes…
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
          {mistakes.data.length === 0
            ? 'No mistakes logged yet. Add them when you log a class.'
            : 'Nothing here.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Mistakes">
          {shown.map((mistake) => (
            <li key={mistake.id}>
              <MistakeCard mistake={mistake} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MistakeCard({ mistake }: { mistake: Mistake }) {
  const update = useUpdateMistake()
  const remove = useDeleteMistake()
  const busy = update.isPending || remove.isPending

  return (
    <article
      aria-label={mistake.description}
      className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <p className="whitespace-pre-line">{mistake.description}</p>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
        <Badge>{categoryLabel(mistake.category)}</Badge>
        {mistake.technique && (
          <Link
            to={`/techniques/${mistake.technique.slug}`}
            className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-300"
          >
            {mistake.technique.name}
          </Link>
        )}
        {mistake.position && <Badge tone="blue">{mistake.position.name}</Badge>}
        {mistake.session && (
          <span>
            {formatDate(mistake.session.date)} · {classTypeLabel(mistake.session.type)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label="Status"
          className="flex flex-1 overflow-hidden rounded-lg border border-slate-700"
        >
          {MISTAKE_STATUSES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={mistake.status === value}
              disabled={busy}
              onClick={() =>
                mistake.status !== value &&
                update.mutate({ id: mistake.id, changes: { status: value } })
              }
              className={`min-h-10 flex-1 border-r border-slate-700 px-1 text-xs font-medium last:border-r-0 ${
                mistake.status === value ? STATUS_STYLES[value] : 'text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          variant="danger"
          className="px-2"
          aria-label="Delete mistake"
          disabled={busy}
          onClick={() => window.confirm('Delete this mistake?') && remove.mutate(mistake.id)}
        >
          ✕
        </Button>
      </div>
      {mistake.status === 'fixed' && mistake.fixed_at && (
        <p className="text-xs text-emerald-300">
          Fixed on {formatDate(mistake.fixed_at.slice(0, 10))}
        </p>
      )}
      {(update.isError || remove.isError) && <ErrorMessage error={update.error ?? remove.error} />}
    </article>
  )
}
