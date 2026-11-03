import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../App'
import { positions, techniqueList } from '../test/fixtures'
import { mockApi, route } from '../test/render'
import { AuthGate } from './AuthGate'
import { AuthProvider } from './AuthProvider'

type Listener = (event: string, session: Session | null) => void

/** Minimal stand-in for the Supabase auth client. */
function fakeSupabase({ session = null as Session | null, password = 'secret' } = {}) {
  let listener: Listener = () => {}
  const auth = {
    onAuthStateChange: vi.fn((callback: Listener) => {
      listener = callback
      queueMicrotask(() => callback('INITIAL_SESSION', session))
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    signInWithPassword: vi.fn(async (creds: { email: string; password: string }) => {
      if (creds.password !== password) {
        return { data: {}, error: new Error('Invalid login credentials') }
      }
      listener('SIGNED_IN', fakeSession())
      return { data: {}, error: null }
    }),
    signOut: vi.fn(async () => {
      listener('SIGNED_OUT', null)
      return { error: null }
    }),
  }
  return { auth } as unknown as SupabaseClient & { auth: typeof auth }
}

function fakeSession(): Session {
  return { access_token: 'token', user: { email: 'owner@example.com' } } as unknown as Session
}

function libraryApi(techniques: () => Response = () => Response.json(techniqueList)) {
  return mockApi(
    route('GET', '/positions', () => Response.json(positions)),
    route('GET', '/techniques', techniques),
  )
}

function renderApp(client: SupabaseClient | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <AuthProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/techniques']}>
          <AuthGate>
            <AppRoutes />
          </AuthGate>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthProvider>,
  )
}

describe('without Supabase (local dev)', () => {
  it('skips the login screen', async () => {
    libraryApi()

    renderApp(null)

    expect(await screen.findByText('3 techniques')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })
})

describe('with Supabase auth', () => {
  it('shows the login screen when signed out', async () => {
    const fetchMock = libraryApi()
    renderApp(fakeSupabase())

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('signs in with email and password', async () => {
    libraryApi()
    const client = fakeSupabase()
    renderApp(client)

    await userEvent.type(await screen.findByLabelText('Email'), ' owner@example.com ')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'secret',
    })
    expect(await screen.findByText('3 techniques')).toBeInTheDocument()
  })

  it('shows a friendly error for a wrong password', async () => {
    renderApp(fakeSupabase())

    await userEvent.type(await screen.findByLabelText('Email'), 'owner@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('restores a stored session and signs out', async () => {
    libraryApi()
    const client = fakeSupabase({ session: fakeSession() })
    renderApp(client)

    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(client.auth.signOut).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('signs out and explains when the account is not the owner', async () => {
    libraryApi(() => Response.json({ detail: 'Not the owner' }, { status: 403 }))
    const client = fakeSupabase({ session: fakeSession() })
    renderApp(client)

    await waitFor(() => expect(client.auth.signOut).toHaveBeenCalled())
    expect(
      await screen.findByText('This account is not allowed to use this app.'),
    ).toBeInTheDocument()
  })

  it('signs out when the API rejects the token', async () => {
    libraryApi(() => Response.json({ detail: 'Invalid or expired token' }, { status: 401 }))
    const client = fakeSupabase({ session: fakeSession() })
    renderApp(client)

    expect(await screen.findByText('Your session expired. Sign in again.')).toBeInTheDocument()
  })
})
