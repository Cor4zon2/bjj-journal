import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase as defaultClient } from '../lib/supabase'
import { AuthContext, type AuthContextValue, type AuthState } from './AuthContext'

type Props = {
  children: ReactNode
  /** Injected in tests; defaults to the app's Supabase client. */
  client?: SupabaseClient | null
}

export function AuthProvider({ children, client = defaultClient }: Props) {
  const [auth, setAuth] = useState<AuthState>(() =>
    client ? { status: 'loading' } : { status: 'disabled' },
  )

  useEffect(() => {
    if (!client) return
    // Fires once immediately with the stored session (INITIAL_SESSION), then on every
    // sign-in, sign-out and token refresh.
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setAuth(session ? { status: 'signedIn', session } : { status: 'signedOut' })
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!client) return
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    [client],
  )

  const signOut = useCallback(async () => {
    if (!client) return
    await client.auth.signOut()
  }, [client])

  const value = useMemo<AuthContextValue>(
    () => ({ auth, signIn, signOut }),
    [auth, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
