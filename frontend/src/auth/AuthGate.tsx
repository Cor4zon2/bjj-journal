import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { LoginScreen } from './LoginScreen'

/** Renders the app only once signed in (or when login is disabled for local dev). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { auth } = useAuth()

  if (auth.status === 'loading') {
    return (
      <main className="flex min-h-svh items-center justify-center bg-slate-950 text-slate-400">
        <p role="status">Loading…</p>
      </main>
    )
  }
  if (auth.status === 'signedOut') {
    return <LoginScreen notice={auth.notice} />
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
  return children
}
