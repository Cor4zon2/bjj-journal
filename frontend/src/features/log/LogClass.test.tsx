import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSession, positions, techniqueList } from '../../test/fixtures'
import { calls, mockApi, renderApp, route } from '../../test/render'
import { DRAFT_KEY, loadDraft } from './draft'

const catalog = [
  route('GET', '/techniques', () => Response.json(techniqueList)),
  route('GET', '/positions', () => Response.json(positions)),
]

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

function posts(fetchMock: ReturnType<typeof mockApi>) {
  return calls(fetchMock).filter(([method, path]) => method === 'POST' && path === '/sessions')
}

describe('Log a class', () => {
  it('logs techniques and an inline mistake in one save', async () => {
    const fetchMock = mockApi(
      ...catalog,
      route('POST', '/sessions', () => Response.json(makeSession(), { status: 201 })),
      route('GET', '/sessions', () => Response.json([makeSession()])),
    )
    const user = userEvent.setup()
    renderApp('/log/new')

    await user.click(screen.getByRole('button', { name: 'Open mat' }))
    await user.click(screen.getByRole('button', { name: '90 min' }))
    await user.click(screen.getByRole('button', { name: 'Energy 4 of 5: Good' }))

    await user.type(screen.getByLabelText('Add a technique'), 'trip')
    await user.click(await screen.findByRole('button', { name: 'Tripod sweep' }))
    // Added as drilled; mark it hit in rolling too.
    const covered = screen.getByRole('group', { name: 'Tripod sweep: covered as' })
    expect(within(covered).getByRole('button', { name: 'Drilled' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(within(covered).getByRole('button', { name: 'Hit' }))

    await user.click(screen.getByRole('button', { name: '+ Add a mistake' }))
    await user.type(screen.getByLabelText('Mistake 1'), 'Lost the hook')
    const categories = screen.getByRole('group', { name: 'Mistake 1 category' })
    await user.click(within(categories).getByRole('button', { name: 'Hook retention' }))
    // The only technique of the class is linked by default.
    expect(screen.getByLabelText('Linked to')).toHaveDisplayValue('Tripod sweep')

    await user.type(screen.getByLabelText('Rolling notes'), 'Good rounds')
    await user.click(screen.getByRole('button', { name: 'Save class' }))

    expect(await screen.findByText('Class saved.')).toBeInTheDocument()
    const [[, , body]] = posts(fetchMock)
    expect(body).toMatchObject({
      type: 'open_mat',
      duration_min: 90,
      energy: 4,
      rolling_notes: 'Good rounds',
      techniques: [
        { technique_id: 10, kind: 'drilled' },
        { technique_id: 10, kind: 'hit_in_rolling' },
      ],
      mistakes: [
        {
          description: 'Lost the hook',
          category: 'hook_retention',
          technique_id: 10,
          position_id: null,
          status: 'open',
        },
      ],
    })
    expect((body as { client_id: string }).client_id).toBeTruthy()
    // Saved: the draft is gone.
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('links a mistake to a position', async () => {
    const fetchMock = mockApi(
      ...catalog,
      route('POST', '/sessions', () => Response.json(makeSession(), { status: 201 })),
      route('GET', '/sessions', () => Response.json([])),
    )
    const user = userEvent.setup()
    renderApp('/log/new')

    await user.click(screen.getByRole('button', { name: '+ Add a mistake' }))
    await user.type(screen.getByLabelText('Mistake 1'), 'Flat on my butt')
    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Linked to')).getAllByRole('option').length,
      ).toBeGreaterThan(3),
    )
    await user.selectOptions(screen.getByLabelText('Linked to'), 'De La Riva guard')
    await user.click(screen.getByRole('button', { name: 'Save class' }))

    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1))
    expect(posts(fetchMock)[0][2]).toMatchObject({
      mistakes: [{ technique_id: null, position_id: 2 }],
    })
  })

  it('keeps a half-filled log when the signal drops, then sends it once back online', async () => {
    let online = false
    const fetchMock = mockApi(
      ...catalog,
      ({ url, method }) => {
        if (method !== 'POST' || url.pathname !== '/sessions') return undefined
        if (!online) throw new TypeError('Failed to fetch')
        return Response.json(makeSession(), { status: 201 })
      },
      route('GET', '/sessions', () => Response.json([makeSession()])),
    )
    const user = userEvent.setup()
    const { unmount } = renderApp('/log/new')

    await user.click(screen.getByRole('button', { name: 'Drilling' }))
    await user.type(screen.getByLabelText('Rolling notes'), 'No rolling today')
    unmount()

    // Reopening the app restores the draft.
    renderApp('/log/new')
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved log restored')
    expect(screen.getByLabelText('Rolling notes')).toHaveValue('No rolling today')
    expect(screen.getByRole('button', { name: 'Drilling' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Save class' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No signal')
    expect(loadDraft()?.rolling_notes).toBe('No rolling today')

    online = true
    window.dispatchEvent(new Event('online'))

    expect(await screen.findByText('Class saved.')).toBeInTheDocument()
    const sent = posts(fetchMock)
    expect(sent).toHaveLength(2)
    // Same client id both times, so the server can't create the class twice.
    expect((sent[0][2] as { client_id: string }).client_id).toBe(
      (sent[1][2] as { client_id: string }).client_id,
    )
    expect(loadDraft()).toBeNull()
  })

  it('can discard a restored draft', async () => {
    mockApi(...catalog)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    const { unmount } = renderApp('/log/new')
    await user.type(screen.getByLabelText('Rolling notes'), 'Old notes')
    unmount()

    renderApp('/log/new')
    await user.click(screen.getByRole('button', { name: 'Start over' }))

    expect(screen.getByLabelText('Rolling notes')).toHaveValue('')
    expect(screen.queryByText(/Unsaved log restored/)).not.toBeInTheDocument()
    expect(loadDraft()).toBeNull()
  })
})

describe('Class history', () => {
  it('lists classes with techniques and mistakes', async () => {
    mockApi(route('GET', '/sessions', () => Response.json([makeSession()])))

    renderApp('/log')

    const card = await screen.findByRole('article', { name: /Gi class/ })
    expect(within(card).getByText(/90 min · Energy 4\/5 · Good/)).toBeInTheDocument()
    expect(within(card).getByText('Drilled')).toBeInTheDocument()
    expect(within(card).getByText('Hit in rolling')).toBeInTheDocument()
    expect(within(card).getByText('Lost the DLR hook')).toBeInTheDocument()
    expect(within(card).getByText('Five rounds.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: "Log today's class" })).toHaveAttribute(
      'href',
      '/log/new',
    )
  })

  it('offers to continue an unsaved log', async () => {
    mockApi(route('GET', '/sessions', () => Response.json([])))
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ techniques: [], mistakes: [] }))

    renderApp('/log')

    expect(await screen.findByText('No classes logged yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue unsaved log' })).toBeInTheDocument()
  })

  it('deletes a class after confirming', async () => {
    let sessions = [makeSession()]
    const fetchMock = mockApi(
      route('GET', '/sessions', () => Response.json(sessions)),
      route('DELETE', '/sessions/1', () => {
        sessions = []
        return new Response(null, { status: 204 })
      }),
    )
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/log')

    await user.click(await screen.findByRole('button', { name: /Delete class on/ }))

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 mistake will be deleted too'))
    expect(await screen.findByText('No classes logged yet.')).toBeInTheDocument()
    expect(calls(fetchMock)).toContainEqual(['DELETE', '/sessions/1', undefined])
  })

  it('edits a class', async () => {
    const fetchMock = mockApi(
      ...catalog,
      route('GET', '/sessions/1', () => Response.json(makeSession())),
      route('PATCH', '/sessions/1', () => Response.json(makeSession({ energy: 2 }))),
      route('GET', '/sessions', () => Response.json([makeSession({ energy: 2 })])),
    )
    const user = userEvent.setup()
    renderApp('/log/1/edit')

    expect(await screen.findByLabelText('Mistake 1')).toHaveValue('Lost the DLR hook')
    await user.click(screen.getByRole('button', { name: 'Energy 2 of 5: Tired' }))
    await user.selectOptions(screen.getByLabelText('Status'), 'Working on it')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('article', { name: /Gi class/ })).toBeInTheDocument()
    const patch = calls(fetchMock).find(([method]) => method === 'PATCH')
    expect(patch?.[2]).toMatchObject({
      energy: 2,
      techniques: [
        { technique_id: 10, kind: 'drilled' },
        { technique_id: 10, kind: 'hit_in_rolling' },
      ],
      mistakes: [{ id: 7, description: 'Lost the DLR hook', status: 'working' }],
    })
  })
})
