import { useEffect, useState } from 'react'
import { ApiError, getHealth, getMe, type Health, type Me } from './api/client'
import { useAuth } from './auth/AuthContext'
import { LoginScreen } from './auth/LoginScreen'

type Load<T> = { kind: 'loading' } | { kind: 'ok'; value: T } | { kind: 'error'; error: unknown }

export default function App() {
  const { auth } = useAuth()

  if (auth.status === 'loading') {
    return (
      <main className="flex min-h-svh items-center justify-center bg-slate-950 text-slate-400">
        <p role="status">Loading…</p>
      </main>
    )
  }
  if (auth.status === 'signedOut') {
    return <LoginScreen />
  }
  if (auth.status === 'disabled' && import.meta.env.PROD) {
    // A production build without Supabase settings would just get 401s from the API.
    return (
      <main className="flex min-h-svh items-center justify-center bg-slate-950 p-6 text-slate-100">
        <p role="alert" className="rounded-lg bg-red-900/60 px-4 py-2">
          Login is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and redeploy.
        </p>
      </main>
    )
  }
  return <Home />
}

function useLoad<T>(load: (signal: AbortSignal) => Promise<T>): Load<T> {
  const [state, setState] = useState<Load<T>>({ kind: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .then((value) => setState({ kind: 'ok', value }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: 'error', error })
      })
    return () => controller.abort()
  }, [load])
  return state
}

function Home() {
  const { auth, signOut } = useAuth()
  const health = useLoad(getHealth)
  const me = useLoad(getMe)

  // A token the API rejects (revoked, or not the owner) means the session is useless.
  const rejected = me.kind === 'error' && me.error instanceof ApiError && me.error.status === 401

  useEffect(() => {
    if (rejected) void signOut()
  }, [rejected, signOut])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-slate-950 p-6 text-slate-100">
      <h1 className="text-4xl font-bold tracking-tight">BJJ Journal</h1>
      <p className="text-slate-400">Oss! The mat is ready.</p>
      <ApiStatus state={health} />
      <Account state={me} />
      {auth.status === 'disabled' ? (
        <p className="text-xs text-amber-400">Dev mode: login disabled (no Supabase configured)</p>
      ) : (
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Sign out
        </button>
      )}
    </main>
  )
}

function ApiStatus({ state }: { state: Load<Health> }) {
  if (state.kind === 'loading') {
    return <p role="status">Checking API…</p>
  }
  if (state.kind === 'error') {
    return (
      <p role="status" className="rounded-lg bg-red-900/60 px-4 py-2">
        API unreachable: {errorMessage(state.error)}
      </p>
    )
  }
  return (
    <p role="status" className="rounded-lg bg-emerald-900/60 px-4 py-2">
      API is {state.value.status} (v{state.value.version})
    </p>
  )
}

function Account({ state }: { state: Load<Me> }) {
  if (state.kind === 'loading') return null
  if (state.kind === 'error') {
    const forbidden = state.error instanceof ApiError && state.error.status === 403
    return (
      <p className="rounded-lg bg-red-900/60 px-4 py-2 text-sm">
        {forbidden ? 'This account is not allowed to use this app.' : errorMessage(state.error)}
      </p>
    )
  }
  return (
    <p className="text-sm text-slate-400">Signed in as {state.value.email ?? state.value.id}</p>
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
