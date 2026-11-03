import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'

export function LoginScreen({ notice }: { notice?: string }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(friendlyError(err))
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-slate-950 p-6 text-slate-100">
      <img src="/icons/pwa-192x192.png" alt="" className="mb-4 h-20 w-20 rounded-2xl" />
      <h1 className="mb-8 text-3xl font-bold tracking-tight">BJJ Journal</h1>
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        {notice && !error && (
          <p role="status" className="rounded-lg bg-amber-900/60 px-3 py-2 text-sm">
            {notice}
          </p>
        )}
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Email
          <input
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-base text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-base text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-red-900/60 px-3 py-2 text-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.'
  if (/fetch|network/i.test(message)) return 'No connection. Check your signal and try again.'
  return message
}
