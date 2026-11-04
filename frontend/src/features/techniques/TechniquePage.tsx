import { Link, useParams } from 'react-router'
import { useTechnique } from '../../api/queries'
import { ApiError } from '../../api/client'
import type { TechniqueRef } from '../../api/types'
import { MasteryPips } from '../../components/MasteryPips'
import { Badge, ErrorMessage, Section } from '../../components/ui'
import { STAT_LABELS, UNLOCK_MASTERY, typeLabel } from '../../lib/labels'
import { EditableList } from './EditableList'
import { FocusToggle } from './FocusToggle'
import { MasteryPicker } from './MasteryPicker'
import { NotesEditor } from './NotesEditor'
import { VideosSection } from './VideosSection'

export function TechniquePage() {
  const { slug = '' } = useParams()
  const technique = useTechnique(slug)

  if (technique.isPending) {
    return (
      <p role="status" className="text-slate-400">
        Loading…
      </p>
    )
  }
  if (technique.isError) {
    const notFound = technique.error instanceof ApiError && technique.error.status === 404
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        {notFound ? (
          <p>This technique does not exist.</p>
        ) : (
          <ErrorMessage error={technique.error} />
        )}
      </div>
    )
  }

  const t = technique.data
  return (
    <article className="flex flex-col gap-4">
      <BackLink />
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="amber">{typeLabel(t.type)}</Badge>
          <Badge>{STAT_LABELS[t.stat]}</Badge>
          {t.gi_only && <Badge tone="blue">Gi only</Badge>}
          {t.locked && <Badge>🔒 Locked</Badge>}
        </div>
        <h1 className="text-2xl leading-tight font-bold">{t.name}</h1>
        {(t.from_position || t.to_position) && (
          <p className="text-sm text-slate-400">
            {t.from_position?.name ?? '—'} → {t.to_position?.name ?? '—'}
          </p>
        )}
        {t.summary && <p className="text-slate-300">{t.summary}</p>}
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <MasteryPips level={t.mastery} size="md" />
          <span>{t.mastery_name}</span>
          <span aria-hidden="true">·</span>
          <span>
            Hit {t.times_hit} {t.times_hit === 1 ? 'time' : 'times'} in rolling
          </span>
        </div>
        <FocusToggle technique={t} />
      </header>

      {t.locked && (
        <p className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-slate-300">
          Locked: it unlocks when{' '}
          {t.prereqs
            .filter((p) => p.mastery < UNLOCK_MASTERY)
            .map((p) => p.name)
            .join(', ')}{' '}
          {t.prereqs.filter((p) => p.mastery < UNLOCK_MASTERY).length === 1 ? 'reaches' : 'reach'}{' '}
          Drilled. You can still log it as Seen.
        </p>
      )}

      <MasteryPicker technique={t} />

      {t.prereqs.length > 0 && (
        <TechniqueLinks
          title="Needs first"
          hint="Unlocks when these reach Drilled"
          techniques={t.prereqs}
        />
      )}

      <EditableList technique={t} field="steps" title="Steps" itemLabel="Step" ordered />
      <EditableList technique={t} field="key_details" title="Key details" itemLabel="Detail" />

      {t.common_mistakes.length > 0 && (
        <Section title="Common mistakes">
          <ul className="flex flex-col gap-3">
            {t.common_mistakes.map((mistake) => (
              <li key={mistake.id} className="rounded-xl bg-slate-950/60 p-3">
                <p className="font-medium text-red-200">{mistake.title}</p>
                {mistake.why_it_happens && (
                  <p className="mt-1 text-sm text-slate-400">{mistake.why_it_happens}</p>
                )}
                {mistake.fix && (
                  <p className="mt-2 text-sm text-emerald-200">
                    <span className="font-semibold">Fix: </span>
                    {mistake.fix}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <VideosSection technique={t} />

      <NotesEditor key={t.id} technique={t} />

      {t.unlocks.length > 0 && <TechniqueLinks title="Leads to" techniques={t.unlocks} />}
    </article>
  )
}

function BackLink() {
  return (
    <Link to="/techniques" className="self-start text-sm text-amber-300">
      ← All techniques
    </Link>
  )
}

function TechniqueLinks({
  title,
  hint,
  techniques,
}: {
  title: string
  hint?: string
  techniques: TechniqueRef[]
}) {
  return (
    <Section title={title}>
      {hint && <p className="-mt-2 mb-2 text-xs text-slate-500">{hint}</p>}
      <ul className="flex flex-wrap gap-2">
        {techniques.map((technique) => (
          <li key={technique.id}>
            <Link
              to={`/techniques/${technique.slug}`}
              className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 text-sm"
            >
              {technique.locked && <span aria-hidden="true">🔒</span>}
              {technique.name}
              {technique.locked && <span className="sr-only"> (locked)</span>}
              <MasteryPips level={technique.mastery} />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
