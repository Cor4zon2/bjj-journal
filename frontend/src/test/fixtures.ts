import type {
  ClassSession,
  Mistake,
  Position,
  Progress,
  Technique,
  TechniqueSummary,
  VideoLink,
} from '../api/types'

export const positions: Position[] = [
  { id: 1, slug: 'standing', name: 'Standing', category: 'standing', description: '' },
  { id: 2, slug: 'de-la-riva-guard', name: 'De La Riva guard', category: 'guard', description: '' },
  { id: 3, slug: 'top-after-sweep', name: 'Top (after sweep)', category: 'top', description: '' },
]

const ref = (p: Position) => ({ id: p.id, slug: p.slug, name: p.name, category: p.category })

export const youtubeVideo: VideoLink = {
  id: 1,
  technique_id: 10,
  url: 'https://youtu.be/dQw4w9WgXcQ',
  source: 'youtube',
  title: 'Tripod breakdown',
  start_seconds: 0,
  embed_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
}

export const reel: VideoLink = {
  id: 2,
  technique_id: 10,
  url: 'https://www.instagram.com/reel/C1a2b3c4d5e/',
  source: 'instagram',
  title: '',
  start_seconds: 0,
  embed_url: null,
}

export function makeTechnique(overrides: Partial<Technique> = {}): Technique {
  return {
    id: 10,
    slug: 'tripod-sweep',
    name: 'Tripod sweep',
    type: 'sweep',
    stat: 'sweeps',
    summary: 'Push the hip, pull the ankle.',
    mastery: 1,
    mastery_name: 'Seen',
    locked: false,
    times_hit: 0,
    gi_only: false,
    from_position: ref(positions[1]),
    to_position: ref(positions[2]),
    from_position_id: 2,
    to_position_id: 3,
    steps: ['Grab the ankle', 'Foot on the hip', 'Push and pull'],
    key_details: ['Opposite directions'],
    notes: '',
    prereqs: [{ id: 5, slug: 'dlr-grips', name: 'DLR grips', mastery: 2, locked: false }],
    unlocks: [
      { id: 11, slug: 'dlr-back-take', name: 'DLR to back take', mastery: 0, locked: true },
    ],
    videos: [youtubeVideo, reel],
    common_mistakes: [
      {
        id: 1,
        technique_id: 10,
        title: 'Letting go of the ankle',
        why_it_happens: 'Celebrating the fall.',
        fix: 'Keep the ankle and come up on top.',
      },
    ],
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    ...overrides,
  }
}

export function summary(t: Technique): TechniqueSummary {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    type: t.type,
    stat: t.stat,
    summary: t.summary,
    mastery: t.mastery,
    mastery_name: t.mastery_name,
    locked: t.locked,
    times_hit: t.times_hit,
    gi_only: t.gi_only,
    from_position: t.from_position,
    to_position: t.to_position,
  }
}

export const techniqueList: TechniqueSummary[] = [
  summary(makeTechnique()),
  summary(
    makeTechnique({
      id: 20,
      slug: 'sit-down-guard-pull',
      name: 'Sit-down guard pull',
      type: 'pull',
      stat: 'guard',
      mastery: 2,
      mastery_name: 'Drilled',
      from_position: ref(positions[0]),
      to_position: null,
    }),
  ),
  summary(
    makeTechnique({
      id: 30,
      slug: 'berimbolo',
      name: 'Berimbolo',
      type: 'entry',
      stat: 'guard',
      mastery: 0,
      mastery_name: 'Not started',
      locked: true,
    }),
  ),
]

export function makeSession(overrides: Partial<ClassSession> = {}): ClassSession {
  const tripod = { id: 10, slug: 'tripod-sweep', name: 'Tripod sweep', mastery: 1, locked: false }
  return {
    id: 1,
    client_id: null,
    date: '2026-11-02',
    type: 'gi_class',
    duration_min: 90,
    energy: 4,
    rolling_notes: 'Five rounds.',
    techniques: [
      { technique_id: 10, kind: 'drilled', technique: tripod },
      { technique_id: 10, kind: 'hit_in_rolling', technique: tripod },
    ],
    mistakes: [
      {
        id: 7,
        session_id: 1,
        technique_id: 10,
        position_id: null,
        category: 'hook_retention',
        description: 'Lost the DLR hook',
        status: 'open',
        fixed_at: null,
        created_at: '2026-11-02T20:00:00Z',
        technique: tripod,
        position: null,
      },
    ],
    created_at: '2026-11-02T20:00:00Z',
    updated_at: '2026-11-02T20:00:00Z',
    ...overrides,
  }
}

export function makeMistake(overrides: Partial<Mistake> = {}): Mistake {
  const session = makeSession()
  return {
    ...session.mistakes[0],
    session: { id: session.id, date: session.date, type: session.type },
    ...overrides,
  }
}

export function makeProgress(overrides: Partial<Progress> = {}): Progress {
  const stat = (stat: Progress['stats'][number]['stat'], value: number, techniques: number) => ({
    stat,
    value,
    techniques,
    points: Math.round((value * techniques * 5) / 10),
    max_points: techniques * 5,
  })
  return {
    today: '2026-11-03',
    belt: 'white',
    stripes: 1,
    classes: 38,
    classes_this_month: 2,
    mat_hours: 75.5,
    streak: { weeks: 5, best_weeks: 7, trained_this_week: true, last_class: '2026-11-02' },
    stats: [
      stat('guard', 2.6, 7),
      stat('sweeps', 2, 4),
      stat('passing', 0, 0),
      stat('escapes', 2.7, 3),
      stat('submissions', 2, 2),
      stat('takedowns', 0, 0),
    ],
    focus: [techniqueList[1], techniqueList[0]],
    top_mistake: {
      count: 3,
      category: 'hook_retention',
      description: 'DLR hook too shallow',
      mistake_id: 7,
      technique: { id: 10, slug: 'tripod-sweep', name: 'Tripod sweep', mastery: 1, locked: false },
      position: null,
    },
    ...overrides,
  }
}
