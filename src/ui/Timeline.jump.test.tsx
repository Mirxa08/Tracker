import { createRef } from 'react'
import { render } from '@testing-library/react'
import { addEvent, addTrack, createProject, projectBounds } from '../domain/project'
import { xForTime } from '../domain/time'
import { Timeline, type TimelineHandle } from './Timeline'

let VIEWPORT_WIDTH = 900
let GUTTER_WIDTH = 190
const NOW = new Date(2026, 5, 15, 12, 0, 0)

const scrollTo = vi.fn()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  scrollTo.mockClear()
  VIEWPORT_WIDTH = 900
  GUTTER_WIDTH = 190
  // jsdom has no layout and no Element.scrollTo: stand them in.
  HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => VIEWPORT_WIDTH })
  // jsdom reports offsetWidth 0 for everything, which would collapse the gutter term to nothing.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => GUTTER_WIDTH })
})

afterEach(() => {
  vi.useRealTimers()
  // @ts-expect-error restoring jsdom's lack of scrollTo
  delete HTMLElement.prototype.scrollTo
  // @ts-expect-error restoring jsdom's default clientWidth
  delete HTMLElement.prototype.clientWidth
  // @ts-expect-error restoring jsdom's default offsetWidth
  delete HTMLElement.prototype.offsetWidth
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

// Geometry, written independently of the production expression: the gutter G covers the left
// of the viewport, so the visible canvas is (cw - G) wide. The now-line, at canvas offset x,
// appears at viewport position G + x - scrollLeft. It should sit a third of the way across
// the visible canvas, i.e. at G + (cw - G) / 3.
function lineViewportX(scrollLeft: number, x: number, gutter: number): number {
  return gutter + x - scrollLeft
}

function lastScrollLeft(): number {
  return (scrollTo.mock.calls.at(-1)![0] as { left: number }).left
}

test('jump to now puts the now-line a third of the way across the visible canvas', () => {
  const p = project()
  const ref = createRef<TimelineHandle>()
  render(<Timeline ref={ref} project={p} />)
  scrollTo.mockClear() // ignore the on-mount scroll

  ref.current!.scrollToNow()

  const x = xForTime(NOW, projectBounds(p, NOW).start)
  expect(scrollTo).toHaveBeenCalledTimes(1)
  expect(scrollTo.mock.calls[0][0]).toMatchObject({ behavior: 'smooth' })
  expect(x - (900 - 190) / 3).toBeGreaterThan(0) // the clamp must not be what makes this pass
  expect(lineViewportX(lastScrollLeft(), x, 190)).toBeCloseTo(190 + (900 - 190) / 3, 6)
  // The old formula (ignoring the gutter) lands somewhere else entirely.
  expect(lastScrollLeft()).not.toBeCloseTo(x - 900 / 3, 3)
})

test('the timeline opens at today with the same gutter-aware offset', () => {
  const p = project()
  render(<Timeline project={p} />)
  const x = xForTime(NOW, projectBounds(p, NOW).start)
  expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
  expect(lineViewportX(lastScrollLeft(), x, 190)).toBeCloseTo(190 + (900 - 190) / 3, 6)
})

test('with a zero-width gutter the line sits a third of the whole viewport across', () => {
  GUTTER_WIDTH = 0 // also what jsdom reports unstubbed: the fallback must be harmless
  const p = project()
  const ref = createRef<TimelineHandle>()
  render(<Timeline ref={ref} project={p} />)
  scrollTo.mockClear()
  ref.current!.scrollToNow()
  const x = xForTime(NOW, projectBounds(p, NOW).start)
  expect(lineViewportX(lastScrollLeft(), x, 0)).toBeCloseTo(900 / 3, 6)
})

test('jump to now never scrolls to a negative offset', () => {
  // A visible canvas wider than three times the distance to today would put the target left of zero.
  VIEWPORT_WIDTH = 1_000_000
  const p = project()
  const ref = createRef<TimelineHandle>()
  render(<Timeline ref={ref} project={p} />)
  expect(xForTime(NOW, projectBounds(p, NOW).start) - (VIEWPORT_WIDTH - GUTTER_WIDTH) / 3).toBeLessThan(0)
  scrollTo.mockClear()
  ref.current!.scrollToNow()
  expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' })
})

test('the open-at-today scroll re-runs for the first track and for another project, not for re-renders', () => {
  const empty = createProject('Empty')
  const { rerender } = render(<Timeline project={empty} />)
  expect(scrollTo).not.toHaveBeenCalled() // no viewport yet, nothing to scroll

  const withTrack = addTrack(empty, 'Banners') // same project id, first track appears
  rerender(<Timeline project={withTrack} />)
  expect(scrollTo).toHaveBeenCalledTimes(1)

  rerender(<Timeline project={addTrack(withTrack, 'Second')} />) // same id, still has tracks
  expect(scrollTo).toHaveBeenCalledTimes(1)

  rerender(<Timeline project={project()} />) // a different project is shown
  expect(scrollTo).toHaveBeenCalledTimes(2)
  expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'auto' }))
})
