import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { isNetworkError } from '../../api/client'
import { useCreateSession } from '../../api/queries'
import { Button } from '../../components/ui'
import { clearDraft, emptyDraft, loadDraft, saveDraft, toPayload, type LogDraft } from './draft'
import { LogForm, SaveError } from './LogForm'

function savedAgo(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Log today's class. Every change is kept on the device, so a half-filled log survives
 * losing signal, closing the app or a reload, until it is saved.
 */
export function NewClassPage() {
  const navigate = useNavigate()
  const create = useCreateSession()
  const [restored] = useState(loadDraft)
  const [draft, setDraft] = useState<LogDraft>(() => restored ?? emptyDraft())
  const [showRestored, setShowRestored] = useState(restored !== null)
  const [waitingForSignal, setWaitingForSignal] = useState(false)

  const change = (next: LogDraft) => {
    setDraft(next)
    saveDraft(next)
  }

  const { mutate, isPending } = create
  const submit = useCallback(() => {
    saveDraft(draft)
    mutate(
      { ...toPayload(draft), client_id: draft.client_id },
      {
        onSuccess: () => {
          clearDraft()
          setWaitingForSignal(false)
          void navigate('/log', { state: { saved: true } })
        },
        onError: (error) => setWaitingForSignal(isNetworkError(error)),
      },
    )
  }, [draft, mutate, navigate])

  // Saving failed for lack of signal: send it as soon as the phone is back online.
  useEffect(() => {
    if (!waitingForSignal) return
    window.addEventListener('online', submit)
    return () => window.removeEventListener('online', submit)
  }, [waitingForSignal, submit])

  const startOver = () => {
    if (!window.confirm('Discard this unsaved log?')) return
    clearDraft()
    setDraft(emptyDraft())
    setShowRestored(false)
    create.reset()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/log" className="text-sm text-amber-300">
          ← Class log
        </Link>
      </div>
      <h1 className="text-2xl font-bold">Log a class</h1>
      {showRestored && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-lg bg-sky-950/60 px-3 py-2 text-sm text-sky-100"
        >
          <span>
            Unsaved log restored{restored?.updated_at && ` (from ${savedAgo(restored.updated_at)})`}
            .
          </span>
          <Button variant="ghost" className="min-h-8" onClick={startOver}>
            Start over
          </Button>
        </div>
      )}
      <LogForm
        value={draft}
        onChange={change}
        onSubmit={submit}
        submitting={isPending}
        submitLabel="Save class"
        error={
          create.isError ? (
            <SaveError error={create.error} offline={isNetworkError(create.error)} keptOnDevice />
          ) : undefined
        }
      />
    </div>
  )
}
