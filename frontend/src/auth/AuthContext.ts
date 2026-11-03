import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState =
  | { status: 'loading' }
  /** `notice` explains why the user was signed out, if it wasn't their choice. */
  | { status: 'signedOut'; notice?: string }
  | { status: 'signedIn'; session: Session }
  /** Supabase isn't configured: local dev without login. */
  | { status: 'disabled' }

export type AuthContextValue = {
  auth: AuthState
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
