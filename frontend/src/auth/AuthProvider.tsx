import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { setAuthFailureHandler } from '../api/client'
import { supabase as defaultClient } from '../lib/supabase'
import { AuthContext, type AuthContextValue, type AuthState } from './AuthContext'

type Props = {
  children: ReactNode
  /** Injected in tests; defaults to the app's Supabase client. */
  client?: SupabaseClient | null
}

const NOTICES = {
  401: 'Your session expired. Sign in again.',
  403: 'This account is not allowed to use this app.',
} as const

export function AuthProvider({ children, client = defaultClient }: Props) {
  const [auth, setAuth] = useState<AuthState>(() =>
    client ? { status: 'loading' } : { status: 'disabled' },
  )
  const notice = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!client) return
    // Fires once immediately with the stored session (INITIAL_SESSION), then on every
    // sign-in, sign-out and token refresh.
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAuth({ status: 'signedIn', session })
      } else {
        setAuth({ status: 'signedOut', notice: notice.current })
        notice.current = undefined
      }
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  useEffect(() => {
    if (!client) return
    // A token the API rejects is useless: drop it and say why on the login screen.
    setAuthFailureHandler((status) => {
      notice.current = NOTICES[status]
      void client.auth.signOut()
    })
    return () => setAuthFailureHandler(null)
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
