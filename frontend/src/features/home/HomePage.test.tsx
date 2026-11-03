import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile, ProfileUpdate, Progress } from '../../api/types'
import { makeProgress } from '../../test/fixtures'
import { calls, mockApi, renderApp, route } from '../../test/render'

function homeApi(progress: Progress = makeProgress()) {
  let current = progress
  return mockApi(
    route('GET', '/progress', () => Response.json(current)),
    route('PATCH', '/profile', (body) => {
      const changes = body as ProfileUpdate
      current = {
        ...current,
        belt: changes.belt ?? current.belt,
        stripes: changes.stripes ?? current.stripes,
      }
      const profile: Profile = {
        belt: current.belt,
        stripes: current.stripes,
        focus_technique_ids: current.focus.map((t) => t.id),
      }
      return Response.json(profile)
    }),
  )
}

describe('Home', () => {
  beforeEach(() => {
    // Tuesday 3 November 2026, 9 pm local time.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 3, 21, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("asks for progress for the phone's local date", async () => {
    const fetchMock = homeApi()

    renderApp('/')

    await screen.findByRole('region', { name: 'Rank' })
    expect(calls(fetchMock)).toContainEqual(['GET', '/progress?today=2026-11-03', undefined])
  })

  it('shows belt, classes, mat time and streak', async () => {
    homeApi()

    renderApp('/')

    const rank = await screen.findByRole('region', { name: 'Rank' })
    expect(within(rank).getByRole('img', { name: 'White belt · 1 stripe' })).toBeInTheDocument()
    expect(within(rank).getByText('38')).toBeInTheDocument()
    expect(within(rank).getByText('75.5 h on the mat')).toBeInTheDocument()
    expect(within(rank).getByText('2 classes this month')).toBeInTheDocument()
    expect(screen.getByLabelText('Training streak: 5-week streak')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Log today's class/ })).toHaveAttribute(
      'href',
      '/log/new',
    )
  })

  it('warns when the streak needs a class this week', async () => {
    homeApi(
      makeProgress({
        streak: { weeks: 3, best_weeks: 3, trained_this_week: false, last_class: '2026-10-29' },
      }),
    )

    renderApp('/')

    expect(await screen.findByText('Train this week to keep it')).toBeInTheDocument()
  })

  it('shows every stat out of 10', async () => {
    homeApi()

    renderApp('/')

    const guard = await screen.findByRole('meter', { name: 'Guard' })
    expect(guard).toHaveAttribute('aria-valuenow', '2.6')
    expect(screen.getAllByRole('meter')).toHaveLength(6)
    expect(screen.getByRole('meter', { name: 'Takedowns' })).toHaveAttribute('aria-valuenow', '0')
  })

  it('lists focus techniques and the top mistake', async () => {
    homeApi()

    renderApp('/')

    const focus = (await screen.findByRole('heading', { name: 'Current focus' })).closest(
      'section',
    )!
    const links = within(focus).getAllByRole('link', { name: /guard pull|sweep/i })
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/techniques/sit-down-guard-pull',
      '/techniques/tripod-sweep',
    ])
    const mistake = screen.getByRole('link', {
      name: 'Top mistake this month: DLR hook too shallow',
    })
    expect(mistake).toHaveAttribute('href', '/mistakes')
    expect(within(mistake).getByText('Tripod sweep · Hook retention · 3 times this month'))
  })

  it('explains how to pick focus techniques and hides an empty top mistake', async () => {
    homeApi(
      makeProgress({
        classes: 0,
        streak: { weeks: 0, best_weeks: 0, trained_this_week: false, last_class: null },
        focus: [],
        top_mistake: null,
      }),
    )

    renderApp('/')

    expect(await screen.findByText(/No focus techniques yet/)).toBeInTheDocument()
    expect(screen.getByLabelText('Training streak: No streak yet')).toBeInTheDocument()
    expect(screen.queryByText('Top mistake this month')).not.toBeInTheDocument()
  })

  it('sets belt and stripes by hand', async () => {
    const fetchMock = homeApi()
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Edit belt' }))
    const form = screen.getByRole('form', { name: 'Edit belt' })
    await user.selectOptions(within(form).getByLabelText('Belt'), 'Blue belt')
    await user.click(within(form).getByRole('radio', { name: '0' }))
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(calls(fetchMock)).toContainEqual(['PATCH', '/profile', { belt: 'blue', stripes: 0 }])
    expect(await screen.findByRole('img', { name: 'Blue belt' })).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Edit belt' })).not.toBeInTheDocument()
  })

  it('is the start page and the first tab', async () => {
    homeApi()

    renderApp('/')

    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link')[0]).toHaveTextContent('Home')
    expect(await screen.findByRole('heading', { name: 'Oss.' })).toBeInTheDocument()
  })
})
