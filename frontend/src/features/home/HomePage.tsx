import { useState } from 'react'
import { Link } from 'react-router'
import { useProgress } from '../../api/queries'
import type { Progress, StatScore, Streak, TechniqueSummary, TopMistake } from '../../api/types'
import { BeltBar } from '../../components/BeltBar'
import { ErrorMessage, Section } from '../../components/ui'
import {
  STAT_LABELS,
  beltLabel,
  categoryLabel,
  formatLongDate,
  times,
  today,
  typeLabel,
} from '../../lib/labels'
import { BeltEditor } from './BeltEditor'

export function HomePage() {
  const date = today()
  const progress = useProgress(date)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{formatLongDate(date)}</p>
          <h1 className="text-3xl font-bold tracking-wide uppercase">Oss.</h1>
        </div>
        {progress.data && <StreakChip streak={progress.data.streak} />}
      </header>

      {progress.isPending && (
        <p role="status" className="text-slate-400">
          Loading…
        </p>
      )}
      {progress.isError && <ErrorMessage error={progress.error} />}

      {progress.data && (
        <>
          <RankCard progress={progress.data} />
          <LogButton />
          <StatsCard stats={progress.data.stats} />
          <FocusList focus={progress.data.focus} />
          {progress.data.top_mistake && <TopMistakeCard mistake={progress.data.top_mistake} />}
        </>
      )}
    </div>
  )
}

function FlameIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2.5 2 3 3 0-2 0-4 0-6z" />
    </svg>
  )
}

function StreakChip({ streak }: { streak: Streak }) {
  const label = streak.weeks === 0 ? 'No streak yet' : `${streak.weeks}-week streak`
  const hint =
    streak.weeks > 0 && !streak.trained_this_week ? 'Train this week to keep it' : undefined
  return (
    <div className="flex flex-col items-end gap-1">
      <p
        aria-label={`Training streak: ${label}`}
        className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm font-semibold"
      >
        <span className={streak.weeks > 0 ? 'text-orange-400' : 'text-slate-500'}>
          <FlameIcon />
        </span>
        {label}
      </p>
      {hint && <p className="text-xs text-orange-300">{hint}</p>}
    </div>
  )
}

function RankCard({ progress }: { progress: Progress }) {
  const [editing, setEditing] = useState(false)
  return (
    <section
      aria-label="Rank"
      className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <BeltBar belt={progress.belt} stripes={progress.stripes} />
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">
              {beltLabel(progress.belt, progress.stripes)}
            </span>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="min-h-8 rounded-full px-2 text-xs text-amber-300"
              >
                Edit belt
              </button>
            )}
          </div>
        </div>
        <p className="flex flex-col items-end">
          <span className="text-5xl leading-none font-bold">{progress.classes}</span>
          <span className="text-xs tracking-wider text-slate-400 uppercase">
            {progress.classes === 1 ? 'Class' : 'Classes'}
          </span>
        </p>
      </div>
      {editing && (
        <BeltEditor
          belt={progress.belt}
          stripes={progress.stripes}
          onDone={() => setEditing(false)}
        />
      )}
      <div className="flex justify-between border-t border-slate-800 pt-3 text-sm text-slate-400">
        <span>{formatHours(progress.mat_hours)} on the mat</span>
        <span>
          {progress.classes_this_month} {progress.classes_this_month === 1 ? 'class' : 'classes'}{' '}
          this month
        </span>
      </div>
    </section>
  )
}

function formatHours(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`
}

function LogButton() {
  return (
    <Link
      to="/log/new"
      className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-amber-400 text-lg font-bold text-slate-950 active:bg-amber-300"
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        +
      </span>
      Log today's class
    </Link>
  )
}

function StatsCard({ stats }: { stats: StatScore[] }) {
  return (
    <Section title="Stats">
      <ul className="grid grid-cols-2 gap-x-5 gap-y-3.5">
        {stats.map((stat) => (
          <li key={stat.stat} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">{STAT_LABELS[stat.stat]}</span>
              <span className="font-semibold">{stat.value.toFixed(1)}</span>
            </div>
            <div
              role="meter"
              aria-label={STAT_LABELS[stat.stat]}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={stat.value}
              className="h-1.5 overflow-hidden rounded-full bg-slate-800"
            >
              <div
                className="h-full rounded-full bg-sky-400"
                style={{ width: `${stat.value * 10}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Each stat adds up the mastery of its techniques, out of 10.
      </p>
    </Section>
  )
}

function FocusList({ focus }: { focus: TechniqueSummary[] }) {
  return (
    <section aria-labelledby="focus-heading" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2
          id="focus-heading"
          className="text-sm font-semibold tracking-wide text-slate-400 uppercase"
        >
          Current focus
        </h2>
        <Link to="/techniques" className="text-sm text-amber-300">
          Library
        </Link>
      </div>
      {focus.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
          No focus techniques yet. Open a technique in the{' '}
          <Link to="/techniques" className="text-amber-300">
            library
          </Link>{' '}
          and tap <span className="font-semibold text-slate-200">Focus</span>.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {focus.map((technique) => (
            <li key={technique.id}>
              <Link
                to={`/techniques/${technique.slug}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 active:bg-slate-800"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${
                    technique.mastery >= 2
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {technique.mastery}
                </span>
                <span className="flex grow flex-col">
                  <span className="font-semibold">{technique.name}</span>
                  <span className="text-xs text-slate-400">
                    {typeLabel(technique.type)} · {technique.mastery_name}
                    {technique.locked && ' · Locked'}
                  </span>
                </span>
                <span aria-hidden="true" className="text-slate-500">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TopMistakeCard({ mistake }: { mistake: TopMistake }) {
  const where = mistake.technique?.name ?? mistake.position?.name
  return (
    <Link
      to="/mistakes"
      aria-label={`Top mistake this month: ${mistake.description}`}
      className="flex flex-col gap-1.5 rounded-2xl border border-orange-900/70 bg-orange-950/40 p-4"
    >
      <span className="text-xs font-semibold tracking-wider text-orange-300 uppercase">
        Top mistake this month
      </span>
      <span className="text-lg font-semibold">{mistake.description}</span>
      <span className="text-sm text-orange-100/70">
        {[where, categoryLabel(mistake.category), `${times(mistake.count)} this month`]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </Link>
  )
}
