import { vi } from 'vitest'
import {
  createProject, addTrack, renameTrack, deleteTrack, reorderTracks,
  addEvent, updateEvent, deleteEvent, eventsForTrack, projectBounds,
} from './project'

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

function seeded() {
  let p = createProject('Wuthering Waves')
  p = addTrack(p, 'Banners')
  p = addEvent(p, {
    trackId: p.tracks[0].id,
    name: 'Lily Banner',
    start: '2026-11-05T00:00:00.000Z',
    end: '2026-11-26T00:00:00.000Z',
  })
  return p
}

test('createProject starts with no tracks or events', () => {
  const p = createProject('Empty')
  expect(p.name).toBe('Empty')
  expect(p.tracks).toEqual([])
  expect(p.events).toEqual([])
  // Ruling 25: dark is the default for a new project, not the platform's preference.
  expect(p.settings.theme).toBe('dark')
})

test('addTrack appends with an incrementing order and a distinct colour', () => {
  let p = addTrack(createProject('P'), 'Banners')
  p = addTrack(p, 'Combat')
  expect(p.tracks.map((t) => t.name)).toEqual(['Banners', 'Combat'])
  expect(p.tracks.map((t) => t.order)).toEqual([0, 1])
  expect(p.tracks[0].color).not.toBe(p.tracks[1].color)
})

test('transforms do not mutate the input project', () => {
  const p = deepFreeze(seeded())
  const trackId = p.tracks[0].id
  const eventId = p.events[0].id
  const results = [
    addTrack(p, 'Another'),
    renameTrack(p, trackId, 'Renamed'),
    deleteTrack(p, trackId),
    reorderTracks(p, [trackId]),
    addEvent(p, { trackId, name: 'Second', start: '2026-12-01T00:00:00.000Z', end: '2026-12-02T00:00:00.000Z' }),
    updateEvent(p, eventId, { name: 'Renamed' }),
    deleteEvent(p, eventId),
    eventsForTrack(p, trackId),
    projectBounds(p, new Date('2026-11-10T00:00:00.000Z')),
  ]
  results.forEach((r) => expect(r).not.toBe(p))
  expect(p.tracks.map((t) => t.name)).toEqual(['Banners'])
  expect(p.events.map((e) => e.name)).toEqual(['Lily Banner'])
})

test('renameTrack changes only the named track', () => {
  let p = seeded()
  p = addTrack(p, 'Combat')
  p = renameTrack(p, p.tracks[0].id, 'Character Banners')
  expect(p.tracks[0].name).toBe('Character Banners')
  expect(p.tracks[1].name).toBe('Combat')
})

test('deleteTrack also removes the events on it', () => {
  const p = seeded()
  const after = deleteTrack(p, p.tracks[0].id)
  expect(after.tracks).toEqual([])
  expect(after.events).toEqual([])
})

test('reorderTracks renumbers according to the given order', () => {
  let p = addTrack(createProject('P'), 'A')
  p = addTrack(p, 'B')
  const reordered = reorderTracks(p, [p.tracks[1].id, p.tracks[0].id])
  expect(reordered.tracks.map((t) => t.name)).toEqual(['B', 'A'])
  expect(reordered.tracks.map((t) => t.order)).toEqual([0, 1])
})

test('reorderTracks ignores ids that do not exist', () => {
  let p = addTrack(createProject('P'), 'A')
  p = addTrack(p, 'B')
  const reordered = reorderTracks(p, ['t_missing', p.tracks[1].id, p.tracks[0].id])
  expect(reordered.tracks.map((t) => t.name)).toEqual(['B', 'A'])
  expect(reordered.tracks.map((t) => t.order)).toEqual([0, 1])
})

test('reorderTracks keeps a track omitted from the list, after the ordered ones, with its events', () => {
  let p = addTrack(createProject('P'), 'A')
  p = addTrack(p, 'B')
  p = addTrack(p, 'C')
  const [a, b, c] = p.tracks
  p = addEvent(p, { trackId: a.id, name: 'OnA', start: '2026-11-01T00:00:00.000Z', end: '2026-11-02T00:00:00.000Z' })
  const reordered = reorderTracks(p, [c.id])
  expect(reordered.tracks.map((t) => t.name)).toEqual(['C', 'A', 'B'])
  expect(reordered.tracks.map((t) => t.order)).toEqual([0, 1, 2])
  expect(reordered.tracks.map((t) => t.id)).toContain(b.id)
  expect(reordered.events.map((e) => e.name)).toEqual(['OnA'])
  expect(reordered.events[0].trackId).toBe(a.id)
})

test('reorderTracks keeps a duplicated id once', () => {
  let p = addTrack(createProject('P'), 'A')
  p = addTrack(p, 'B')
  const [a, b] = p.tracks
  const reordered = reorderTracks(p, [b.id, b.id, a.id])
  expect(reordered.tracks.map((t) => t.name)).toEqual(['B', 'A'])
  expect(reordered.tracks.map((t) => t.order)).toEqual([0, 1])
})

test('addEvent inherits the track colour when none is given', () => {
  const p = seeded()
  expect(p.events[0].color).toBe(p.tracks[0].color)
})

test('addEvent rejects an end that is not after the start', () => {
  const p = seeded()
  expect(() => addEvent(p, {
    trackId: p.tracks[0].id, name: 'Bad',
    start: '2026-11-05T00:00:00.000Z', end: '2026-11-05T00:00:00.000Z',
  })).toThrow(/after/i)
})

test('addEvent rejects an unknown track', () => {
  const p = seeded()
  expect(() => addEvent(p, {
    trackId: 't_missing', name: 'Orphan',
    start: '2026-11-05T00:00:00.000Z', end: '2026-11-06T00:00:00.000Z',
  })).toThrow(/track/i)
})

test('updateEvent patches fields and bumps updatedAt', () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date('2026-11-10T00:00:00.000Z'))
    const p = seeded()
    vi.setSystemTime(new Date('2026-11-10T00:00:05.000Z'))
    const after = updateEvent(p, p.events[0].id, { name: 'Renamed' })
    expect(after).not.toBe(p)
    expect(after.events[0].name).toBe('Renamed')
    expect(p.updatedAt).toBe('2026-11-10T00:00:00.000Z')
    expect(after.updatedAt).toBe('2026-11-10T00:00:05.000Z')
  } finally {
    vi.useRealTimers()
  }
})

test('updateEvent rejects a patch that inverts the dates', () => {
  const p = seeded()
  expect(() => updateEvent(p, p.events[0].id, { end: '2026-11-01T00:00:00.000Z' }))
    .toThrow(/after/i)
})

test('eventsForTrack returns that track\'s events sorted by start', () => {
  let p = seeded()
  p = addEvent(p, {
    trackId: p.tracks[0].id, name: 'Earlier',
    start: '2026-11-01T00:00:00.000Z', end: '2026-11-04T00:00:00.000Z',
  })
  expect(eventsForTrack(p, p.tracks[0].id).map((e) => e.name)).toEqual(['Earlier', 'Lily Banner'])
})

test('projectBounds pads a month either side of the events', () => {
  const p = seeded()
  const { start, end } = projectBounds(p, new Date('2026-11-10T00:00:00.000Z'))
  expect(start.getTime()).toBeLessThan(Date.parse('2026-11-05T00:00:00.000Z'))
  expect(end.getTime()).toBeGreaterThan(Date.parse('2026-11-26T00:00:00.000Z'))
})

test('projectBounds falls back to a window around now when there are no events', () => {
  const now = new Date('2026-11-10T00:00:00.000Z')
  const { start, end } = projectBounds(createProject('Empty'), now)
  expect(start.getTime()).toBeLessThan(now.getTime())
  expect(end.getTime()).toBeGreaterThan(now.getTime())
})
