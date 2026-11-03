import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { positions, techniqueList } from '../../test/fixtures'
import { calls, mockApi, renderApp, route } from '../../test/render'

function listApi() {
  return mockApi(
    route('GET', '/positions', () => Response.json(positions)),
    ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/techniques') return undefined
      const type = url.searchParams.get('type')
      return Response.json(type ? techniqueList.filter((t) => t.type === type) : techniqueList)
    },
  )
}

describe('Technique list', () => {
  it('lists techniques with type, route and mastery', async () => {
    listApi()

    renderApp('/techniques')

    const list = await screen.findByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('3 techniques')).toBeInTheDocument()
    const tripod = screen.getByRole('link', { name: /Tripod sweep/ })
    expect(tripod).toHaveAttribute('href', '/techniques/tripod-sweep')
    expect(within(tripod).getByText('De La Riva guard → Top (after sweep)')).toBeInTheDocument()
    expect(within(tripod).getByRole('img', { name: 'Mastery 1 of 5: Seen' })).toBeInTheDocument()
  })

  it('filters by type through the API', async () => {
    const fetchMock = listApi()
    renderApp('/techniques')
    await screen.findByText('3 techniques')

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Guard pull')

    expect(await screen.findByText('1 technique')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sit-down guard pull/ })).toBeInTheDocument()
    expect(calls(fetchMock).map(([, path]) => path)).toContain('/techniques?type=pull')
  })

  it('sends position, mastery and search filters', async () => {
    const fetchMock = listApi()
    renderApp('/techniques')
    await screen.findByText('3 techniques')

    await userEvent.selectOptions(screen.getByLabelText('Position'), 'De La Riva guard')
    await userEvent.selectOptions(screen.getByLabelText('Mastery'), '0 · Not started')
    await userEvent.type(screen.getByLabelText('Search techniques'), 'bolo')

    await waitFor(() =>
      expect(calls(fetchMock).map(([, path]) => path)).toContain(
        '/techniques?q=bolo&position_id=2&mastery=0',
      ),
    )
  })

  it('shows an error when the API is down', async () => {
    mockApi(() => new Response(null, { status: 503 }))

    renderApp('/techniques')

    expect(await screen.findByRole('alert')).toHaveTextContent('API returned 503')
  })
})
