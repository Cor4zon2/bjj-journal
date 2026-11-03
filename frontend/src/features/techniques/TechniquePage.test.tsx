import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Technique, TechniqueUpdate } from '../../api/types'
import { makeTechnique, positions, techniqueList } from '../../test/fixtures'
import { calls, mockApi, renderApp, route } from '../../test/render'

/** A tiny fake backend for one technique that applies PATCHes. */
function techniqueApi(initial: Technique = makeTechnique()) {
  let technique = initial
  return mockApi(
    route('GET', `/techniques/by-slug/${initial.slug}`, () => Response.json(technique)),
    route('PATCH', `/techniques/${initial.id}`, (body) => {
      const changes = body as TechniqueUpdate
      technique = {
        ...technique,
        ...(changes as Partial<Technique>),
        updated_at: new Date().toISOString(),
      }
      return Response.json(technique)
    }),
    route('POST', `/techniques/${initial.id}/videos`, (body) => {
      const { url, title } = body as { url: string; title: string }
      const video = {
        id: 99,
        technique_id: initial.id,
        url,
        title,
        source: 'instagram' as const,
        start_seconds: 0,
        embed_url: null,
      }
      technique = { ...technique, videos: [...technique.videos, video] }
      return Response.json(video, { status: 201 })
    }),
    ({ url, method }) => {
      const match = /^\/videos\/(\d+)$/.exec(url.pathname)
      if (method !== 'DELETE' || !match) return undefined
      technique = {
        ...technique,
        videos: technique.videos.filter((v) => v.id !== Number(match[1])),
      }
      return new Response(null, { status: 204 })
    },
    route('GET', '/techniques', () => Response.json(techniqueList)),
    route('GET', '/positions', () => Response.json(positions)),
  )
}

describe('Technique page', () => {
  it('shows steps, details, common mistakes and links', async () => {
    techniqueApi()

    renderApp('/techniques/tripod-sweep')

    expect(await screen.findByRole('heading', { name: 'Tripod sweep' })).toBeInTheDocument()
    expect(screen.getByText('De La Riva guard → Top (after sweep)')).toBeInTheDocument()
    const steps = screen.getByRole('heading', { name: 'Steps' }).closest('section')!
    expect(
      within(steps)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Grab the ankle', 'Foot on the hip', 'Push and pull'])
    expect(screen.getByText('Opposite directions')).toBeInTheDocument()
    expect(screen.getByText('Letting go of the ankle')).toBeInTheDocument()
    expect(screen.getByText('Keep the ankle and come up on top.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /DLR grips/ })).toHaveAttribute(
      'href',
      '/techniques/dlr-grips',
    )
    expect(screen.getByRole('link', { name: /DLR to back take/ })).toBeInTheDocument()
  })

  it('embeds YouTube and opens Instagram Reels externally', async () => {
    techniqueApi()

    renderApp('/techniques/tripod-sweep')

    const iframe = await screen.findByTitle('Tripod breakdown')
    expect(iframe.tagName).toBe('IFRAME')
    expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    const reel = screen.getByRole('link', { name: /Open in Instagram/ })
    expect(reel).toHaveAttribute('href', 'https://www.instagram.com/reel/C1a2b3c4d5e/')
    expect(reel).toHaveAttribute('target', '_blank')
  })

  it('suggests a YouTube search when there are no videos', async () => {
    techniqueApi(makeTechnique({ videos: [] }))

    renderApp('/techniques/tripod-sweep')

    const search = await screen.findByRole('link', { name: 'Search YouTube' })
    expect(search).toHaveAttribute(
      'href',
      'https://www.youtube.com/results?search_query=bjj%20Tripod%20sweep',
    )
  })

  it('changes the mastery level', async () => {
    const fetchMock = techniqueApi()
    renderApp('/techniques/tripod-sweep')

    await userEvent.click(await screen.findByRole('radio', { name: '3: Hit in rolling' }))

    expect(await screen.findByRole('radio', { name: '3: Hit in rolling' })).toBeChecked()
    expect(calls(fetchMock)).toContainEqual(['PATCH', '/techniques/10', { mastery: 3 }])
    expect(screen.getByText('— Landed it in sparring at least once')).toBeInTheDocument()
  })

  it('edits and saves my notes', async () => {
    const fetchMock = techniqueApi()
    renderApp('/techniques/tripod-sweep')
    const notes = await screen.findByLabelText('My notes')
    const save = screen.getByRole('button', { name: 'Save notes' })
    expect(save).toBeDisabled()

    await userEvent.type(notes, 'Works on taller partners')
    await userEvent.click(save)

    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.getByLabelText('My notes')).toHaveValue('Works on taller partners')
    expect(calls(fetchMock)).toContainEqual([
      'PATCH',
      '/techniques/10',
      { notes: 'Works on taller partners' },
    ])
  })

  it('edits, reorders and adds steps', async () => {
    const fetchMock = techniqueApi()
    renderApp('/techniques/tripod-sweep')

    await userEvent.click(await screen.findByRole('button', { name: 'Edit steps' }))
    await userEvent.click(screen.getByRole('button', { name: 'Move step 3 up' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove step 1' }))
    await userEvent.click(screen.getByRole('button', { name: '+ Add step' }))
    await userEvent.type(screen.getByLabelText('Step 3'), 'Come up on top')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(calls(fetchMock)).toContainEqual([
      'PATCH',
      '/techniques/10',
      { steps: ['Push and pull', 'Foot on the hip', 'Come up on top'] },
    ])
    const steps = screen.getByRole('heading', { name: 'Steps' }).closest('section')!
    expect(await within(steps).findByText('Come up on top')).toBeInTheDocument()
    expect(within(steps).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('adds a video link', async () => {
    const fetchMock = techniqueApi(makeTechnique({ videos: [] }))
    renderApp('/techniques/tripod-sweep')

    await userEvent.click(await screen.findByRole('button', { name: '+ Add' }))
    await userEvent.type(
      screen.getByLabelText('Link (YouTube or Instagram Reel)'),
      'https://www.instagram.com/reel/XYZ/',
    )
    await userEvent.type(screen.getByLabelText('Title (optional)'), 'Coach reel')
    await userEvent.click(screen.getByRole('button', { name: 'Add video' }))

    expect(await screen.findByRole('link', { name: 'Open in Instagram: Coach reel' })).toBeVisible()
    expect(calls(fetchMock)).toContainEqual([
      'POST',
      '/techniques/10/videos',
      { url: 'https://www.instagram.com/reel/XYZ/', title: 'Coach reel' },
    ])
  })

  it('removes a video after confirming', async () => {
    const fetchMock = techniqueApi()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp('/techniques/tripod-sweep')
    await screen.findByTitle('Tripod breakdown')

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])

    expect(window.confirm).toHaveBeenCalledWith('Remove “Tripod breakdown”?')
    await waitFor(() => expect(screen.queryByTitle('Tripod breakdown')).not.toBeInTheDocument())
    expect(calls(fetchMock)).toContainEqual(['DELETE', '/videos/1', undefined])
  })

  it('says when a technique does not exist', async () => {
    mockApi(() => Response.json({ detail: 'Technique not found' }, { status: 404 }))

    renderApp('/techniques/nope')

    expect(await screen.findByText('This technique does not exist.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← All techniques' })).toBeInTheDocument()
  })
})

describe('Technique page: progress', () => {
  function progressApi(technique: Technique, focus: number[] = []) {
    let profile = { belt: 'white', stripes: 1, focus_technique_ids: focus }
    let current = technique
    return mockApi(
      route('GET', `/techniques/by-slug/${technique.slug}`, () => Response.json(current)),
      route('PATCH', `/techniques/${technique.id}`, (body) => {
        const mastery = (body as TechniqueUpdate).mastery ?? current.mastery
        // Like the API: unlocks follow the new level.
        current = {
          ...current,
          mastery,
          unlocks: current.unlocks.map((u) => ({ ...u, locked: mastery < 2 })),
        }
        return Response.json(current)
      }),
      route('GET', '/profile', () => Response.json(profile)),
      route('PATCH', '/profile', (body) => {
        profile = { ...profile, ...(body as object) }
        return Response.json(profile)
      }),
    )
  }

  it('adds the technique to the focus list on Home and removes it again', async () => {
    const fetchMock = progressApi(makeTechnique(), [20])
    const user = userEvent.setup()
    renderApp('/techniques/tripod-sweep')

    const focus = await screen.findByRole('button', { name: '☆ Focus' })
    expect(focus).toHaveAttribute('aria-pressed', 'false')
    await user.click(focus)

    expect(calls(fetchMock)).toContainEqual([
      'PATCH',
      '/profile',
      { focus_technique_ids: [20, 10] },
    ])
    await user.click(await screen.findByRole('button', { name: '★ Focus', pressed: true }))
    expect(calls(fetchMock)).toContainEqual(['PATCH', '/profile', { focus_technique_ids: [20] }])
  })

  it('allows at most five focus techniques', async () => {
    progressApi(makeTechnique(), [1, 2, 3, 4, 5])

    renderApp('/techniques/tripod-sweep')

    expect(await screen.findByRole('button', { name: '☆ Focus' })).toBeDisabled()
    expect(screen.getByText(/already focus on 5 techniques/)).toBeInTheDocument()
  })

  it('says which prerequisites a locked technique is waiting for', async () => {
    progressApi(
      makeTechnique({
        slug: 'dlr-back-take',
        name: 'DLR to back take',
        mastery: 0,
        locked: true,
        prereqs: [
          { id: 10, slug: 'tripod-sweep', name: 'Tripod sweep', mastery: 1, locked: false },
        ],
        unlocks: [],
      }),
    )

    renderApp('/techniques/dlr-back-take')

    expect(await screen.findByText('🔒 Locked')).toBeInTheDocument()
    expect(screen.getByText(/it unlocks when Tripod sweep reaches Drilled/)).toBeInTheDocument()
  })

  it('announces the techniques unlocked by reaching Drilled', async () => {
    progressApi(makeTechnique({ mastery: 1 }))
    const user = userEvent.setup()
    renderApp('/techniques/tripod-sweep')

    expect(
      await screen.findByRole('link', { name: /^DLR to back take\s*\(locked\)/ }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '2: Drilled' }))

    const notice = await screen.findByText(/Unlocked:/)
    expect(within(notice).getByRole('link', { name: 'DLR to back take' })).toHaveAttribute(
      'href',
      '/techniques/dlr-back-take',
    )
  })
})
