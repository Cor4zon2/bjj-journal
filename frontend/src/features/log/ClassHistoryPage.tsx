import { Link, useLocation } from 'react-router'
import { useDeleteSession, useSessions } from '../../api/queries'
import type { ClassSession, SessionTechniqueKind } from '../../api/types'
import { Badge, Button, ErrorMessage } from '../../components/ui'
import {
  ENERGY_LABELS,
  KIND_LABELS,
  TECHNIQUE_KINDS,
  classTypeLabel,
  formatDate,
  statusLabel,
} from '../../lib/labels'
import { loadDraft } from './draft'

export function ClassHistoryPage() {
  const sessions = useSessions()
  const location = useLocation()
  const justSaved = (location.state as { saved?: boolean } | null)?.saved === true
  const hasDraft = loadDraft() !== null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Class log</h1>
        <p className="text-sm text-slate-400">
          Every class, what you worked on and what went wrong.
        </p>
      </div>

      <Link
        to="/log/new"
        className="flex min-h-12 items-center justify-center rounded-xl bg-amber-400 text-base font-semibold text-slate-950 active:bg-amber-300"
      >
        {hasDraft ? 'Continue unsaved log' : "Log today's class"}
      </Link>

      {justSaved && (
        <p
          role="status"
          className="rounded-lg bg-emerald-950/60 px-3 py-2 text-sm text-emerald-200"
        >
          Class saved.
        </p>
      )}

      {sessions.isError ? (
        <ErrorMessage error={sessions.error} />
      ) : sessions.isPending ? (
        <p role="status" className="text-slate-400">
          Loading classes…
        </p>
      ) : sessions.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
          No classes logged yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Classes">
          {sessions.data.map((session) => (
            <li key={session.id}>
              <SessionCard session={session} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SessionCard({ session }: { session: ClassSession }) {
  const remove = useDeleteSession()
  const byKind = new Map<SessionTechniqueKind, ClassSession['techniques']>()
  for (const row of session.techniques) {
    byKind.set(row.kind, [...(byKind.get(row.kind) ?? []), row])
  }
  const title = `${formatDate(session.date)} · ${classTypeLabel(session.type)}`

  const confirmDelete = () => {
    const extra =
      session.mistakes.length > 0
        ? ` Its ${session.mistakes.length} ${session.mistakes.length === 1 ? 'mistake' : 'mistakes'} will be deleted too.`
        : ''
    if (window.confirm(`Delete the class on ${formatDate(session.date)}?${extra}`)) {
      remove.mutate(session.id)
    }
  }

  return (
    <article
      aria-label={title}
      className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-slate-400">
            {[
              session.duration_min && `${session.duration_min} min`,
              session.energy && `Energy ${session.energy}/5 · ${ENERGY_LABELS[session.energy - 1]}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Link
            to={`/log/${session.id}/edit`}
            className="flex min-h-10 items-center rounded-lg px-3 text-sm text-slate-300 hover:bg-slate-800"
            aria-label={`Edit class on ${formatDate(session.date)}`}
          >
            Edit
          </Link>
          <Button
            variant="danger"
            onClick={confirmDelete}
            disabled={remove.isPending}
            aria-label={`Delete class on ${formatDate(session.date)}`}
          >
            Delete
          </Button>
        </div>
      </header>

      {remove.isError && <ErrorMessage error={remove.error} />}

      {TECHNIQUE_KINDS.map(({ value }) => {
        const rows = byKind.get(value)
        if (!rows) return null
        return (
          <div key={value} className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{KIND_LABELS[value]}</span>
            <div className="flex flex-wrap gap-1.5">
              {rows.map((row) => (
                <Link
                  key={row.technique_id}
                  to={`/techniques/${row.technique.slug}`}
                  className="rounded-full bg-slate-800 px-2.5 py-1 text-xs"
                >
                  {row.technique.name}
                </Link>
              ))}
            </div>
          </div>
        )
      })}

      {session.mistakes.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Mistakes</span>
          <ul className="flex flex-col gap-1">
            {session.mistakes.map((mistake) => (
              <li key={mistake.id} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-red-200">{mistake.description}</span>
                <Badge tone={mistake.status === 'fixed' ? 'blue' : 'slate'}>
                  {statusLabel(mistake.status)}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {session.rolling_notes && (
        <p className="text-sm whitespace-pre-line text-slate-300">{session.rolling_notes}</p>
      )}
    </article>
  )
}
