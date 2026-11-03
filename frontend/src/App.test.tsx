import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

function stubFetch(response: Response | Promise<Response>) {
  const fetchMock = vi.fn(() => Promise.resolve(response))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('App', () => {
  it('shows the API status from /health', async () => {
    const fetchMock = stubFetch(Response.json({ status: 'ok', version: '0.1.0' }))

    render(<App />)

    expect(screen.getByRole('heading', { name: 'BJJ Journal' })).toBeInTheDocument()
    expect(await screen.findByText('API is ok (v0.1.0)')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/health', expect.anything())
  })

  it('shows an error when the API is down', async () => {
    stubFetch(new Response(null, { status: 503 }))

    render(<App />)

    expect(await screen.findByText('API unreachable: API returned 503')).toBeInTheDocument()
  })
})
