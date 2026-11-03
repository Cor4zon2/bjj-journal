import { useId, useMemo, useState, type ReactNode } from 'react'
import { usePositions, useTechniques } from '../../api/queries'
import type { Position, SessionTechniqueKind, TechniqueSummary } from '../../api/types'
import { Button, ErrorMessage } from '../../components/ui'
import {
  CLASS_TYPES,
  ENERGY_LABELS,
  MISTAKE_CATEGORIES,
  MISTAKE_STATUSES,
  TECHNIQUE_KINDS,
} from '../../lib/labels'
import { emptyMistake, type DraftMistake, type DraftTechnique, type LogDraft } from './draft'
import { useOfflineList } from './useOfflineList'

const DURATIONS = [60, 75, 90, 120]
const MAX_RESULTS = 8

const inputClass =
  'min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-base text-slate-100'

type Props = {
  value: LogDraft
  onChange: (draft: LogDraft) => void
  onSubmit: () => void
  submitting: boolean
  submitLabel: string
  error?: ReactNode
  /** Show the status picker on each mistake (editing a saved class). */
  showMistakeStatus?: boolean
}

/** The class log form. Controlled, so the page decides where the draft is kept. */
export function LogForm({
  value,
  onChange,
  onSubmit,
  submitting,
  submitLabel,
  error,
  showMistakeStatus = false,
}: Props) {
  const techniques = useOfflineList('bjj-journal:techniques', useTechniques({}))
  const positions = useOfflineList('bjj-journal:positions', usePositions())
  const set = <K extends keyof LogDraft>(key: K, fieldValue: LogDraft[K]) =>
    onChange({ ...value, [key]: fieldValue })

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label className="flex flex-col gap-1 self-start text-xs text-slate-400">
        Date
        <input
          type="date"
          required
          value={value.date}
          onChange={(event) => set('date', event.target.value)}
          className={`${inputClass} w-auto`}
        />
      </label>

      <ChipGroup label="Class type">
        {CLASS_TYPES.map((type) => (
          <Chip
            key={type.value}
            pressed={value.type === type.value}
            onClick={() => set('type', type.value)}
          >
            {type.label}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup label="Duration">
        {DURATIONS.map((minutes) => (
          <Chip
            key={minutes}
            pressed={value.duration_min === minutes}
            onClick={() => set('duration_min', value.duration_min === minutes ? null : minutes)}
          >
            {minutes} min
          </Chip>
        ))}
        <label className="flex items-center gap-1 text-sm text-slate-400">
          <span className="sr-only">Duration in minutes</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            placeholder="Other"
            value={
              value.duration_min !== null && !DURATIONS.includes(value.duration_min)
                ? value.duration_min
                : ''
            }
            onChange={(event) => {
              const minutes = Number(event.target.value)
              set('duration_min', event.target.value && minutes > 0 ? minutes : null)
            }}
            className="min-h-10 w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 text-base"
          />
        </label>
      </ChipGroup>

      <ChipGroup label="Energy">
        {ENERGY_LABELS.map((label, index) => {
          const level = index + 1
          return (
            <Chip
              key={level}
              pressed={value.energy === level}
              onClick={() => set('energy', value.energy === level ? null : level)}
              ariaLabel={`Energy ${level} of 5: ${label}`}
            >
              {level}
              <span className="ml-1 hidden text-xs text-slate-400 sm:inline">{label}</span>
            </Chip>
          )
        })}
      </ChipGroup>

      <TechniquePicker
        all={techniques}
        selected={value.techniques}
        onChange={(selected) => set('techniques', selected)}
      />

      <MistakesEditor
        mistakes={value.mistakes}
        classTechniques={value.techniques}
        techniques={techniques}
        positions={positions}
        showStatus={showMistakeStatus}
        onChange={(mistakes) => set('mistakes', mistakes)}
      />

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Rolling notes
        <textarea
          rows={3}
          value={value.rolling_notes}
          onChange={(event) => set('rolling_notes', event.target.value)}
          placeholder="Who you rolled with, what worked, what didn't…"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100"
        />
      </label>

      {error}

      <Button
        type="submit"
        variant="primary"
        disabled={submitting}
        className="sticky bottom-3 min-h-12 text-base shadow-lg shadow-slate-950"
      >
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}

// ---- Small pieces --------------------------------------------------------------

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1">
      <span id={id} className="text-xs text-slate-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  pressed,
  onClick,
  children,
  ariaLabel,
  tone = 'amber',
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
  ariaLabel?: string
  tone?: 'amber' | 'emerald' | 'sky'
}) {
  const on = {
    amber: 'border-amber-400 bg-amber-400 text-slate-950',
    emerald: 'border-emerald-400 bg-emerald-400 text-slate-950',
    sky: 'border-sky-400 bg-sky-400 text-slate-950',
  }
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`min-h-10 rounded-full border px-3 text-sm font-medium transition-colors ${
        pressed ? on[tone] : 'border-slate-700 bg-slate-900 text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

// ---- Techniques ----------------------------------------------------------------

const KIND_TONES: Record<SessionTechniqueKind, 'sky' | 'amber' | 'emerald'> = {
  taught: 'sky',
  drilled: 'amber',
  hit_in_rolling: 'emerald',
}

function TechniquePicker({
  all,
  selected,
  onChange,
}: {
  all: TechniqueSummary[]
  selected: DraftTechnique[]
  onChange: (selected: DraftTechnique[]) => void
}) {
  const [search, setSearch] = useState('')
  const searchId = useId()
  const matches = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0) return []
    const taken = new Set(selected.map((t) => t.technique_id))
    return all
      .filter((t) => !taken.has(t.id))
      .filter((t) => words.every((word) => t.name.toLowerCase().includes(word)))
      .slice(0, MAX_RESULTS)
  }, [all, search, selected])

  const add = (technique: TechniqueSummary) => {
    onChange([
      ...selected,
      { technique_id: technique.id, name: technique.name, kinds: ['drilled'] },
    ])
    setSearch('')
  }
  const toggle = (id: number, kind: SessionTechniqueKind) =>
    onChange(
      selected.map((t) =>
        t.technique_id !== id
          ? t
          : {
              ...t,
              kinds: t.kinds.includes(kind)
                ? t.kinds.filter((k) => k !== kind)
                : [...t.kinds, kind],
            },
      ),
    )

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xs text-slate-400">Techniques</legend>
      {selected.length > 0 && (
        <ul className="flex flex-col gap-2">
          {selected.map((t) => (
            <li
              key={t.technique_id}
              className={`flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 ${
                t.kinds.length === 0 ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{t.name}</span>
                <Button
                  variant="danger"
                  className="min-h-8 px-2"
                  aria-label={`Remove ${t.name}`}
                  onClick={() =>
                    onChange(selected.filter((s) => s.technique_id !== t.technique_id))
                  }
                >
                  ✕
                </Button>
              </div>
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label={`${t.name}: covered as`}
              >
                {TECHNIQUE_KINDS.map((kind) => (
                  <Chip
                    key={kind.value}
                    tone={KIND_TONES[kind.value]}
                    pressed={t.kinds.includes(kind.value)}
                    onClick={() => toggle(t.technique_id, kind.value)}
                  >
                    {kind.label}
                  </Chip>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor={searchId} className="sr-only">
        Add a technique
      </label>
      <input
        id={searchId}
        type="search"
        autoComplete="off"
        placeholder="+ Add a technique…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (matches[0]) add(matches[0])
          }
        }}
        className={inputClass}
      />
      {search.trim() && (
        <ul aria-label="Matching techniques" className="flex flex-col gap-1">
          {matches.length === 0 ? (
            <li className="px-1 text-sm text-slate-500">
              {all.length === 0 ? 'Technique list not loaded yet.' : 'No matching technique.'}
            </li>
          ) : (
            matches.map((technique) => (
              <li key={technique.id}>
                <button
                  type="button"
                  onClick={() => add(technique)}
                  className="min-h-11 w-full rounded-lg bg-slate-800 px-3 text-left text-sm active:bg-slate-700"
                >
                  {technique.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </fieldset>
  )
}

// ---- Mistakes ------------------------------------------------------------------

function MistakesEditor({
  mistakes,
  classTechniques,
  techniques,
  positions,
  showStatus,
  onChange,
}: {
  mistakes: DraftMistake[]
  classTechniques: DraftTechnique[]
  techniques: TechniqueSummary[]
  positions: Position[]
  showStatus: boolean
  onChange: (mistakes: DraftMistake[]) => void
}) {
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const update = (key: string, changes: Partial<DraftMistake>) =>
    onChange(mistakes.map((m) => (m.key === key ? { ...m, ...changes } : m)))
  const add = () => {
    // Most mistakes are about the technique of the day: link the only one by default.
    const only = classTechniques.length === 1 ? classTechniques[0].technique_id : null
    const mistake = emptyMistake(only)
    setFocusKey(mistake.key)
    onChange([...mistakes, mistake])
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xs text-slate-400">My mistakes</legend>
      {mistakes.map((mistake, index) => (
        <MistakeRow
          key={mistake.key}
          number={index + 1}
          mistake={mistake}
          autoFocus={mistake.key === focusKey}
          classTechniques={classTechniques}
          techniques={techniques}
          positions={positions}
          showStatus={showStatus}
          onChange={(changes) => update(mistake.key, changes)}
          onRemove={() => onChange(mistakes.filter((m) => m.key !== mistake.key))}
        />
      ))}
      <Button onClick={add} className="self-start">
        + Add a mistake
      </Button>
    </fieldset>
  )
}

function linkValue(mistake: DraftMistake): string {
  if (mistake.technique_id !== null) return `t:${mistake.technique_id}`
  if (mistake.position_id !== null) return `p:${mistake.position_id}`
  return ''
}

function MistakeRow({
  number,
  mistake,
  autoFocus,
  classTechniques,
  techniques,
  positions,
  showStatus,
  onChange,
  onRemove,
}: {
  number: number
  mistake: DraftMistake
  autoFocus: boolean
  classTechniques: DraftTechnique[]
  techniques: TechniqueSummary[]
  positions: Position[]
  showStatus: boolean
  onChange: (changes: Partial<DraftMistake>) => void
  onRemove: () => void
}) {
  const id = useId()
  const inClass = new Set(classTechniques.map((t) => t.technique_id))
  const others = techniques.filter((t) => !inClass.has(t.id))
  // A mistake linked to a technique that is neither in the class nor in the loaded list
  // (e.g. offline) still needs an option, or the select would silently show "Nothing".
  const linkedElsewhere =
    mistake.technique_id !== null &&
    !inClass.has(mistake.technique_id) &&
    !techniques.some((t) => t.id === mistake.technique_id)

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-red-900/60 bg-red-950/20 p-3">
      <div className="flex items-start gap-2">
        <label htmlFor={`${id}-text`} className="sr-only">
          Mistake {number}
        </label>
        <textarea
          id={`${id}-text`}
          rows={2}
          autoFocus={autoFocus}
          value={mistake.description}
          placeholder="What went wrong?"
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base"
        />
        <Button
          variant="danger"
          className="px-2"
          aria-label={`Remove mistake ${number}`}
          onClick={onRemove}
        >
          ✕
        </Button>
      </div>
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={`Mistake ${number} category`}
      >
        {MISTAKE_CATEGORIES.map((category) => (
          <button
            key={category.value}
            type="button"
            aria-pressed={mistake.category === category.value}
            onClick={() => onChange({ category: category.value })}
            className={`min-h-9 rounded-full border px-2.5 text-xs font-medium ${
              mistake.category === category.value
                ? 'border-red-300 bg-red-300 text-slate-950'
                : 'border-slate-700 text-slate-300'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Linked to
        <select
          value={linkValue(mistake)}
          onChange={(event) => {
            const [kind, rawId] = event.target.value.split(':')
            const target = rawId ? Number(rawId) : null
            onChange({
              technique_id: kind === 't' ? target : null,
              position_id: kind === 'p' ? target : null,
            })
          }}
          className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100"
        >
          <option value="">Nothing</option>
          {classTechniques.length > 0 && (
            <optgroup label="In this class">
              {classTechniques.map((t) => (
                <option key={t.technique_id} value={`t:${t.technique_id}`}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
          {linkedElsewhere && (
            <option value={`t:${mistake.technique_id}`}>Technique #{mistake.technique_id}</option>
          )}
          {others.length > 0 && (
            <optgroup label="Other techniques">
              {others.map((t) => (
                <option key={t.id} value={`t:${t.id}`}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
          {positions.length > 0 && (
            <optgroup label="Positions">
              {positions.map((p) => (
                <option key={p.id} value={`p:${p.id}`}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {showStatus && (
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Status
          <select
            value={mistake.status}
            onChange={(event) => onChange({ status: event.target.value as DraftMistake['status'] })}
            className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100"
          >
            {MISTAKE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

export function SaveError({
  error,
  offline,
  keptOnDevice = false,
}: {
  error: unknown
  offline: boolean
  /** The draft is stored on the device and re-sent automatically. */
  keptOnDevice?: boolean
}) {
  if (offline) {
    return (
      <p role="alert" className="rounded-lg bg-amber-900/50 px-4 py-2 text-sm text-amber-100">
        {keptOnDevice
          ? "No signal. Your log is kept on this phone and will be sent when you're back online, or tap Save again."
          : "Couldn't reach the server. Check your connection and tap Save again."}
      </p>
    )
  }
  return <ErrorMessage error={error} />
}
