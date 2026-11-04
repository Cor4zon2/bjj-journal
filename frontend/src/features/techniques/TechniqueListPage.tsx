import { useDeferredValue } from 'react'
import { Link, useSearchParams } from 'react-router'
import { usePositions, useTechniques } from '../../api/queries'
import type { TechniqueFilters, TechniqueSummary, TechniqueType } from '../../api/types'
import { MasteryPips } from '../../components/MasteryPips'
import { Badge, ErrorMessage } from '../../components/ui'
import { MASTERY_LEVELS, TECHNIQUE_TYPES, typeLabel } from '../../lib/labels'

const selectClass =
  'min-h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100'

/** Filters live in the URL so they survive opening a technique and coming back. */
function useFilters() {
  const [params, setParams] = useSearchParams()
  const number = (key: string) => {
    const value = params.get(key)
    return value === null || value === '' ? undefined : Number(value)
  }
  const filters: TechniqueFilters = {
    q: params.get('q') ?? undefined,
    position_id: number('position'),
    type: (params.get('type') as TechniqueType | null) ?? undefined,
    mastery: number('mastery'),
  }
  const set = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  return { filters, set, clear: () => setParams({}, { replace: true }) }
}

export function TechniqueListPage() {
  const { filters, set, clear } = useFilters()
  const query = useDeferredValue(filters.q)
  const positions = usePositions()
  const techniques = useTechniques({ ...filters, q: query?.trim() || undefined })
  const hasFilters = Object.values(filters).some((value) => value !== undefined)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Technique library</h1>
        <p className="text-sm text-slate-400">
          Guard pulls, De La Riva and white belt fundamentals.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor="technique-search">
          Search techniques
        </label>
        <input
          id="technique-search"
          type="search"
          placeholder="Search techniques…"
          value={filters.q ?? ''}
          onChange={(event) => set('q', event.target.value)}
          className="min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-base"
        />
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Position
            <select
              className={selectClass}
              value={filters.position_id ?? ''}
              onChange={(event) => set('position', event.target.value)}
            >
              <option value="">All</option>
              {positions.data?.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Type
            <select
              className={selectClass}
              value={filters.type ?? ''}
              onChange={(event) => set('type', event.target.value)}
            >
              <option value="">All</option>
              {TECHNIQUE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Mastery
            <select
              className={selectClass}
              value={filters.mastery ?? ''}
              onChange={(event) => set('mastery', event.target.value)}
            >
              <option value="">All</option>
              {MASTERY_LEVELS.map((level) => (
                <option key={level.level} value={level.level}>
                  {level.level} · {level.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {techniques.isError ? (
        <ErrorMessage error={techniques.error} />
      ) : techniques.isPending ? (
        <p role="status" className="text-slate-400">
          Loading techniques…
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span role="status">
              {techniques.data.length} {techniques.data.length === 1 ? 'technique' : 'techniques'}
            </span>
            {hasFilters && (
              <button type="button" className="text-amber-300" onClick={clear}>
                Clear filters
              </button>
            )}
          </div>
          {techniques.data.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
              No techniques match these filters.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {techniques.data.map((technique) => (
                <li key={technique.id}>
                  <TechniqueCard technique={technique} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function TechniqueCard({ technique }: { technique: TechniqueSummary }) {
  const { locked } = technique
  const route = [technique.from_position?.name, technique.to_position?.name]
    .filter(Boolean)
    .join(' → ')
  return (
    <Link
      to={`/techniques/${technique.slug}`}
      className={`flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 active:bg-slate-800 ${
        locked ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold">
          {locked && <span aria-hidden="true">🔒 </span>}
          {technique.name}
          {locked && <span className="sr-only"> (locked)</span>}
        </span>
        <Badge>{typeLabel(technique.type)}</Badge>
      </div>
      {route && <span className="text-sm text-slate-400">{route}</span>}
      <span className="flex items-center gap-2 text-xs text-slate-400">
        <MasteryPips level={technique.mastery} />
        {technique.mastery_name}
      </span>
    </Link>
  )
}
