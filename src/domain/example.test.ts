import { expect, test } from 'vitest'
import { exampleProject } from './example'
import { deleteEvent, deleteTrack, eventsForTrack } from './project'
import { validateProject } from './schema'

const NOW = new Date(2026, 4, 14, 9, 30)
const DAY = 86_400_000

/** Which of the three states an event is in at `now`. */
function phase(start: string, end: string, now: Date): 'finished' | 'running' | 'upcoming' {
  if (Date.parse(end) <= now.getTime()) return 'finished'
  if (Date.parse(start) <= now.getTime()) return 'running'
  return 'upcoming'
}

test('the example has several tracks and bars: a visitor sees the product, not an empty grid', () => {
  const p = exampleProject(NOW)
  expect(p.name).toBe('Example timeline')
  expect(p.tracks.length).toBeGreaterThan(1)
  expect(p.events.length).toBeGreaterThan(3)
  // Every track carries bars: a named but empty row shows nothing either.
  for (const track of p.tracks) expect(eventsForTrack(p, track.id).length).toBeGreaterThan(0)
})

test('one event is running right now, so the now-line crosses a bar and a badge shows', () => {
  const p = exampleProject(NOW)
  const phases = p.events.map((e) => phase(e.start, e.end, NOW))
  expect(phases).toContain('running')
  expect(phases).toContain('finished')
  expect(phases).toContain('upcoming')
})

test('two of them overlap on different tracks, which is what the day grid is for', () => {
  const p = exampleProject(NOW)
  const running = p.events.filter((e) => phase(e.start, e.end, NOW) === 'running')
  expect(running.length).toBeGreaterThan(1)
  expect(new Set(running.map((e) => e.trackId)).size).toBeGreaterThan(1)
})

test('it is dated relative to the moment it is built, never hardcoded', () => {
  const early = exampleProject(new Date(2026, 0, 2, 12))
  const late = exampleProject(new Date(2030, 6, 20, 12))
  // Four and a half years apart, so a fixed date could not pass this.
  const earliest = (p: ReturnType<typeof exampleProject>) =>
    Math.min(...p.events.map((e) => Date.parse(e.start)))
  expect(earliest(late) - earliest(early)).toBeGreaterThan(1000 * DAY)
  // And still running at both: the point is that it is always current.
  for (const now of [new Date(2026, 0, 2, 12), new Date(2030, 6, 20, 12)]) {
    const phases = exampleProject(now).events.map((e) => phase(e.start, e.end, now))
    expect(phases).toContain('running')
    expect(phases).toContain('finished')
    expect(phases).toContain('upcoming')
  }
})

test('it is an ordinary project: valid by the schema, with no marker of its own', () => {
  const p = exampleProject(NOW)
  // Round-trips through the real parser, so nothing about it is special-cased.
  expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
  // Nothing in it says "example" except the name the user can change.
  const json = JSON.stringify({ ...p, name: '' })
  expect(json.toLowerCase()).not.toContain('example')
  expect(p.settings).toEqual({ theme: 'dark' })
})

test('every part of it can be deleted like any other project\'s', () => {
  const p = exampleProject(NOW)
  const stripped = p.tracks.reduce((acc, t) => deleteTrack(acc, t.id), p)
  expect(stripped.tracks).toEqual([])
  expect(stripped.events).toEqual([])
  const one = deleteEvent(p, p.events[0].id)
  expect(one.events).toHaveLength(p.events.length - 1)
})

test('two visitors do not get the same ids', () => {
  const a = exampleProject(NOW)
  const b = exampleProject(NOW)
  expect(a.id).not.toBe(b.id)
  expect(a.tracks[0].id).not.toBe(b.tracks[0].id)
})
