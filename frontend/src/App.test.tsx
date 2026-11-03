import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'

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
      listener('SIGNED_IN', fakeSession(creds.email))
      return { data: {}, error: null }
    }),
    signOut: vi.fn(async () => {
      listener('SIGNED_OUT', null)
      return { error: null }
    }),
  }
  return { auth } as unknown as SupabaseClient & { auth: typeof auth }
}

function fakeSession(email = 'owner@example.com'): Session {
  return { access_token: 'token', user: { email } } as unknown as Session
}

function stubApi(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname
    const route = routes[path]
    return Promise.resolve(route ? route() : new Response(null, { status: 404 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const healthy = {
  '/health': () => Response.json({ status: 'ok', version: '0.1.0' }),
  '/me': () => Response.json({ id: 'owner-id', email: 'owner@example.com' }),
}

function renderApp(client: SupabaseClient | null) {
  return render(
    <AuthProvider client={client}>
      <App />
    </AuthProvider>,
  )
}

describe('App without Supabase (local dev)', () => {
  it('skips login and shows the API status', async () => {
    const fetchMock = stubApi(healthy)

    renderApp(null)

    expect(screen.getByRole('heading', { name: 'BJJ Journal' })).toBeInTheDocument()
    expect(await screen.findByText('API is ok (v0.1.0)')).toBeInTheDocument()
    expect(screen.getByText(/Dev mode: login disabled/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/health', expect.anything())
  })

  it('shows an error when the API is down', async () => {
    stubApi({ '/health': () => new Response(null, { status: 503 }) })

    renderApp(null)

    expect(await screen.findByText('API unreachable: API returned 503')).toBeInTheDocument()
  })
})

describe('App with Supabase auth', () => {
  it('shows the login screen when signed out', async () => {
    renderApp(fakeSupabase())

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('signs in with email and password', async () => {
    stubApi(healthy)
    const client = fakeSupabase()
    renderApp(client)

    await userEvent.type(await screen.findByLabelText('Email'), ' owner@example.com ')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'secret',
    })
    expect(await screen.findByText('Signed in as owner@example.com')).toBeInTheDocument()
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
    stubApi(healthy)
    const client = fakeSupabase({ session: fakeSession() })
    renderApp(client)

    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(client.auth.signOut).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('explains when the account is not the owner', async () => {
    stubApi({ ...healthy, '/me': () => new Response(null, { status: 403 }) })
    renderApp(fakeSupabase({ session: fakeSession('stranger@example.com') }))

    expect(
      await screen.findByText('This account is not allowed to use this app.'),
    ).toBeInTheDocument()
  })

  it('signs out when the API rejects the token', async () => {
    stubApi({ ...healthy, '/me': () => new Response(null, { status: 401 }) })
    const client = fakeSupabase({ session: fakeSession() })
    renderApp(client)

    await waitFor(() => expect(client.auth.signOut).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})
