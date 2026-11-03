import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Mistake } from '../../api/types'
import { makeMistake } from '../../test/fixtures'
import { calls, mockApi, renderApp, route } from '../../test/render'

function mistakesApi(initial: Mistake[]) {
  let mistakes = initial
  return mockApi(
    route('GET', '/mistakes', () => Response.json(mistakes)),
    ({ url, method, body }) => {
      const match = /^\/mistakes\/(\d+)$/.exec(url.pathname)
      if (method !== 'PATCH' || !match) return undefined
      const id = Number(match[1])
      mistakes = mistakes.map((m) => (m.id === id ? { ...m, ...(body as object) } : m))
      return Response.json(mistakes.find((m) => m.id === id))
    },
  )
}

const mistakes = [
  makeMistake(),
  makeMistake({
    id: 8,
    description: 'Crossed ankles too low',
    status: 'working',
    category: 'posture',
    technique: null,
    technique_id: null,
  }),
  makeMistake({
    id: 9,
    description: 'No posture break',
    status: 'fixed',
    fixed_at: '2026-11-03T10:00:00Z',
  }),
]

describe('Mistakes', () => {
  it('shows open mistakes by default, with counts per status', async () => {
    mistakesApi(mistakes)

    renderApp('/mistakes')

    const list = await screen.findByRole('list', { name: 'Mistakes' })
    expect(within(list).getAllByRole('article')).toHaveLength(1)
    const card = within(list).getByRole('article', { name: 'Lost the DLR hook' })
    expect(within(card).getByText('Hook retention')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Tripod sweep' })).toHaveAttribute(
      'href',
      '/techniques/tripod-sweep',
    )
    expect(screen.getByRole('tab', { name: 'Working on it (1)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All (3)' })).toBeInTheDocument()
  })

  it('moves a mistake along Open → Working on it → Fixed', async () => {
    const fetchMock = mistakesApi(mistakes)
    const user = userEvent.setup()
    renderApp('/mistakes?status=all')

    const card = await screen.findByRole('article', { name: 'Lost the DLR hook' })
    await user.click(within(card).getByRole('button', { name: 'Working on it' }))

    expect(calls(fetchMock)).toContainEqual(['PATCH', '/mistakes/7', { status: 'working' }])
    expect(await screen.findByRole('tab', { name: 'Working on it (2)' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^Fixed/ }))
    expect(await screen.findByRole('article', { name: 'No posture break' })).toBeInTheDocument()
    expect(screen.getByText('Fixed on Tue 3 Nov')).toBeInTheDocument()
  })

  it('explains where mistakes come from when there are none', async () => {
    mistakesApi([])

    renderApp('/mistakes')

    expect(await screen.findByText(/Add them when you log a class/)).toBeInTheDocument()
  })
})
