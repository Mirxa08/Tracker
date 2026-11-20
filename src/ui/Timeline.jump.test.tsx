import { createRef } from 'react'
import { render } from '@testing-library/react'
import { addEvent, addTrack, createProject, projectBounds } from '../domain/project'
import { xForTime } from '../domain/time'
import { Timeline, type TimelineHandle } from './Timeline'

let VIEWPORT_WIDTH = 900
const NOW = new Date(2026, 5, 15, 12, 0, 0)

const scrollTo = vi.fn()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  scrollTo.mockClear()
  VIEWPORT_WIDTH = 900
  // jsdom has no layout and no Element.scrollTo: stand both in.
  HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => VIEWPORT_WIDTH })
})

afterEach(() => {
  vi.useRealTimers()
  // @ts-expect-error restoring jsdom's lack of scrollTo
  delete HTMLElement.prototype.scrollTo
  // @ts-expect-error restoring jsdom's default clientWidth
  delete HTMLElement.prototype.clientWidth
})

function project() {
  const base = addTrack(createProject('P'), 'Banners')
  return addEvent(base, {
    trackId: base.tracks[0].id,
    name: 'Long',
    start: new Date(2026, 4, 15).toISOString(),
    end: new Date(2026, 6, 15).toISOString(),
    notes: { columns: [], rows: [] },
  })
}

test('jump to now scrolls so the now-line sits a third of the way across', () => {
  const p = project()
  const ref = createRef<TimelineHandle>()
  render(<Timeline ref={ref} project={p} />)
  scrollTo.mockClear() // ignore the on-mount scroll

  ref.current!.scrollToNow()

  const expected = xForTime(NOW, projectBounds(p, NOW).start) - VIEWPORT_WIDTH / 3
  expect(expected).toBeGreaterThan(0) // otherwise Math.max(0, …) would hide a wrong formula
  expect(scrollTo).toHaveBeenCalledTimes(1)
  expect(scrollTo).toHaveBeenCalledWith({ left: expected, behavior: 'smooth' })
})

test('the timeline opens at today without being asked', () => {
  const p = project()
  render(<Timeline project={p} />)
  const expected = xForTime(NOW, projectBounds(p, NOW).start) - VIEWPORT_WIDTH / 3
  expect(scrollTo).toHaveBeenCalledWith({ left: expected, behavior: 'auto' })
})

test('jump to now never scrolls to a negative offset', () => {
  // A viewport wider than three times the distance to today would put the target left of zero.
  VIEWPORT_WIDTH = 1_000_000
  const p = project()
  const ref = createRef<TimelineHandle>()
  render(<Timeline ref={ref} project={p} />)
  expect(xForTime(NOW, projectBounds(p, NOW).start) - VIEWPORT_WIDTH / 3).toBeLessThan(0)
  scrollTo.mockClear()
  ref.current!.scrollToNow()
  expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' })
})
