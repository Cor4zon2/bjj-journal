import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, isNetworkError } from '../../api/client'
import { useSession, useUpdateSession } from '../../api/queries'
import type { ClassSession } from '../../api/types'
import { ErrorMessage } from '../../components/ui'
import { fromSession, toPayload, type LogDraft } from './draft'
import { LogForm, SaveError } from './LogForm'

export function EditClassPage() {
  const id = Number(useParams().id)
  const session = useSession(id)

  return (
    <div className="flex flex-col gap-4">
      <Link to="/log" className="self-start text-sm text-amber-300">
        ← Class log
      </Link>
      <h1 className="text-2xl font-bold">Edit class</h1>
      {session.isPending ? (
        <p role="status" className="text-slate-400">
          Loading…
        </p>
      ) : session.isError ? (
        session.error instanceof ApiError && session.error.status === 404 ? (
          <p>This class does not exist.</p>
        ) : (
          <ErrorMessage error={session.error} />
        )
      ) : (
        <EditForm key={session.data.id} session={session.data} />
      )}
    </div>
  )
}

function EditForm({ session }: { session: ClassSession }) {
  const navigate = useNavigate()
  const update = useUpdateSession(session.id)
  const [draft, setDraft] = useState<LogDraft>(() => fromSession(session))

  return (
    <LogForm
      value={draft}
      onChange={setDraft}
      showMistakeStatus
      onSubmit={() => update.mutate(toPayload(draft), { onSuccess: () => void navigate('/log') })}
      submitting={update.isPending}
      submitLabel="Save changes"
      error={
        update.isError ? (
          <SaveError error={update.error} offline={isNetworkError(update.error)} />
        ) : undefined
      }
    />
  )
}
