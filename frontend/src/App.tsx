import { useEffect, useState } from 'react'
import { getHealth, type Health } from './api/client'

type ApiState =
  { kind: 'loading' } | { kind: 'ok'; health: Health } | { kind: 'error'; message: string }

export default function App() {
  const [api, setApi] = useState<ApiState>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then((health) => setApi({ kind: 'ok', health }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setApi({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
      })
    return () => controller.abort()
  }, [])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-slate-950 p-6 text-slate-100">
      <h1 className="text-4xl font-bold tracking-tight">BJJ Journal</h1>
      <p className="text-slate-400">Oss! The mat is ready.</p>
      <ApiStatus state={api} />
    </main>
  )
}

function ApiStatus({ state }: { state: ApiState }) {
  if (state.kind === 'loading') {
    return <p role="status">Checking API…</p>
  }
  if (state.kind === 'error') {
    return (
      <p role="status" className="rounded-lg bg-red-900/60 px-4 py-2">
        API unreachable: {state.message}
      </p>
    )
  }
  return (
    <p role="status" className="rounded-lg bg-emerald-900/60 px-4 py-2">
      API is {state.health.status} (v{state.health.version})
    </p>
  )
}
