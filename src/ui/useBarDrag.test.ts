import type { TrackEvent } from '../domain/schema'
import { DAY_WIDTH } from '../domain/time'
import { applyDrag, applyDragHours, dragDates } from './useBarDrag'

const event: TrackEvent = {
  id: 'e_1', trackId: 't_1', name: 'Lily Banner',
  start: new Date(2026, 10, 5, 0, 0).toISOString(),
  end: new Date(2026, 10, 26, 0, 0).toISOString(),
  color: '#7a5cff',
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

test('moving shifts both ends by the same number of days', () => {
  const moved = applyDrag(event, 'move', 3)
  expect(new Date(moved.start).getDate()).toBe(8)
  expect(new Date(moved.end).getDate()).toBe(29)
})

test('resizing the end moves only the end', () => {
  const resized = applyDrag(event, 'resize-end', -4)
  expect(resized.start).toBe(event.start)
  expect(new Date(resized.end).getDate()).toBe(22)
})

test('resizing the start moves only the start', () => {
  const resized = applyDrag(event, 'resize-start', 2)
  expect(new Date(resized.start).getDate()).toBe(7)
  expect(resized.end).toBe(event.end)
})

test('a resize cannot invert the event: a minimum of one day is kept', () => {
  const resized = applyDrag(event, 'resize-end', -100)
  expect(Date.parse(resized.end)).toBeGreaterThan(Date.parse(resized.start))
})

test('a move preserves the duration exactly', () => {
  const duration = Date.parse(event.end) - Date.parse(event.start)
  const moved = applyDrag(event, 'move', -9)
  expect(Date.parse(moved.end) - Date.parse(moved.start)).toBe(duration)
})

test('a move preserves the duration of an event with a time of day', () => {
  const timed = {
    ...event,
    start: new Date(2026, 10, 5, 13, 30).toISOString(),
    end: new Date(2026, 10, 9, 7, 15).toISOString(),
  }
  const duration = Date.parse(timed.end) - Date.parse(timed.start)
  const moved = applyDrag(timed, 'move', 6)
  expect(Date.parse(moved.end) - Date.parse(moved.start)).toBe(duration)
  const movedHours = applyDragHours(timed, 'move', -37)
  expect(Date.parse(movedHours.end) - Date.parse(movedHours.start)).toBe(duration)
})

test('resizing the end stops exactly at one day after the start, not before', () => {
  const floorEnd = Date.parse(event.start) + DAY
  // 21 days long; shrinking by 20 lands exactly on the floor, by more is clamped to it.
  expect(Date.parse(applyDrag(event, 'resize-end', -500).end)).toBe(floorEnd)
  expect(Date.parse(applyDrag(event, 'resize-end', -21).end)).toBe(floorEnd)
  expect(Date.parse(applyDrag(event, 'resize-end', -20).end)).toBe(floorEnd)
  expect(Date.parse(applyDrag(event, 'resize-end', -19).end)).toBe(floorEnd + DAY)
  expect(applyDrag(event, 'resize-end', -500).start).toBe(event.start)
})

test('resizing the start stops exactly at one day before the end, not after', () => {
  const ceilingStart = Date.parse(event.end) - DAY
  expect(Date.parse(applyDrag(event, 'resize-start', 400).start)).toBe(ceilingStart)
  expect(Date.parse(applyDrag(event, 'resize-start', 21).start)).toBe(ceilingStart)
  expect(Date.parse(applyDrag(event, 'resize-start', 20).start)).toBe(ceilingStart)
  expect(Date.parse(applyDrag(event, 'resize-start', 19).start)).toBe(ceilingStart - DAY)
  expect(applyDrag(event, 'resize-start', 400).end).toBe(event.end)
})

test('hour resizing keeps a minimum of one hour and never inverts', () => {
  const endResized = applyDragHours(event, 'resize-end', -100_000)
  expect(Date.parse(endResized.end)).toBe(Date.parse(event.start) + HOUR)
  const startResized = applyDragHours(event, 'resize-start', 100_000)
  expect(Date.parse(startResized.start)).toBe(Date.parse(event.end) - HOUR)
})

test('hour moves and resizes shift by whole hours', () => {
  expect(Date.parse(applyDragHours(event, 'move', 5).start)).toBe(Date.parse(event.start) + 5 * HOUR)
  expect(Date.parse(applyDragHours(event, 'resize-end', 3).end)).toBe(Date.parse(event.end) + 3 * HOUR)
  expect(applyDragHours(event, 'resize-end', 3).start).toBe(event.start)
})

test('day moves keep the wall-clock time across a daylight-saving change', () => {
  const spanning = {
    ...event,
    start: new Date(2026, 2, 27, 0, 0).toISOString(),
    end: new Date(2026, 2, 28, 0, 0).toISOString(),
  }
  const moved = applyDrag(spanning, 'move', 3)
  expect(new Date(moved.start).getHours()).toBe(0)
  expect(new Date(moved.end).getHours()).toBe(0)
  expect(new Date(moved.start).getDate()).toBe(30)
})

test('dragDates snaps to whole days by default and to the hour with the modifier', () => {
  // 2.4 days of travel: a whole-day snap gives 2 days, an hour snap gives 58 hours.
  const dx = 2.4 * DAY_WIDTH
  const byDay = dragDates(event, 'move', dx, false)
  const byHour = dragDates(event, 'move', dx, true)
  expect(byDay).not.toBeNull()
  expect(byHour).not.toBeNull()
  expect(new Date(byDay!.start).getTime()).toBe(new Date(2026, 10, 7).getTime())
  expect(Date.parse(byHour!.start) - Date.parse(event.start)).toBe(58 * HOUR)
  expect(byDay!.start).not.toBe(byHour!.start)
})

test('dragDates reports no change for travel that snaps to nothing', () => {
  expect(dragDates(event, 'move', 0.4 * DAY_WIDTH, false)).toBeNull()
  expect(dragDates(event, 'move', 0.4 * DAY_WIDTH, true)).not.toBeNull()
  expect(dragDates(event, 'move', 0.01 * DAY_WIDTH, true)).toBeNull()
})

test('dragDates carries negative travel and the resize modes through', () => {
  const left = dragDates(event, 'resize-start', -3 * DAY_WIDTH, false)
  expect(new Date(left!.start).getDate()).toBe(2)
  expect(left!.end).toBe(event.end)
  const right = dragDates(event, 'resize-end', 5 * DAY_WIDTH, false)
  expect(new Date(right!.end).getMonth()).toBe(11)
  expect(new Date(right!.end).getDate()).toBe(1)
  expect(right!.start).toBe(event.start)
})
