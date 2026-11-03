import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { AppRoutes } from '../App'
import { AuthProvider } from '../auth/AuthProvider'

export function renderApp(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <AuthProvider client={null}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthProvider>,
  )
}

type Handler = (request: { url: URL; method: string; body: unknown }) => Response | undefined

/** Stub `fetch` with a list of handlers; the first one returning a Response wins. */
export function mockApi(...handlers: Handler[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    for (const handler of handlers) {
      const response = handler({ url, method, body })
      if (response) return response
    }
    return Response.json({ detail: `No mock for ${method} ${url.pathname}` }, { status: 500 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function route(method: string, path: string, respond: (body: unknown) => Response): Handler {
  return (request) =>
    request.method === method && request.url.pathname === path ? respond(request.body) : undefined
}

/** Calls made to `fetch` as `[method, path + search, body]`. */
export function calls(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls.map(([input, init]) => {
    const url = new URL(String(input))
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    return [init?.method ?? 'GET', url.pathname + url.search, body] as const
  })
}
