import { fireEvent, render, screen } from '@testing-library/react'
import type { TrackEvent } from '../domain/schema'
import { DAY_WIDTH } from '../domain/time'
import { EventBar } from './EventBar'

const viewStart = new Date(2026, 10, 1)
const now = new Date(2026, 10, 10, 12, 0)

const event: TrackEvent = {
  id: 'e_1',
  trackId: 't_1',
  name: 'Lily Banner',
  start: new Date(2026, 10, 5).toISOString(),
  end: new Date(2026, 10, 26).toISOString(),
  color: '#7a5cff',
}

function setup(overrides: { onSelect?: () => void; onChangeDates?: (d: { start: string; end: string }) => void } = {}) {
  const onSelect = overrides.onSelect ?? vi.fn()
  const onChangeDates = overrides.onChangeDates ?? vi.fn()
  const view = render(
    <EventBar event={event} viewStart={viewStart} now={now} onSelect={onSelect} onChangeDates={onChangeDates} />,
  )
  const bar = screen.getByRole('button', { name: /Lily Banner/ })
  return { ...view, bar, onSelect, onChangeDates }
}

function drag(target: Element, dx: number, init: { shiftKey?: boolean } = {}) {
  fireEvent.pointerDown(target, { clientX: 100, pointerId: 1, button: 0 })
  fireEvent.pointerMove(target, { clientX: 100 + dx, pointerId: 1, ...init })
  fireEvent.pointerUp(target, { clientX: 100 + dx, pointerId: 1, ...init })
}

function handle(bar: HTMLElement, which: 'start' | 'end') {
  const el = bar.querySelector(`.event-bar__handle--${which}`)
  if (!el) throw new Error(`no ${which} handle`)
  return el
}

test('dragging the bar moves both ends by whole days', () => {
  const { bar, onChangeDates } = setup()
  drag(bar, 3 * DAY_WIDTH)
  expect(onChangeDates).toHaveBeenCalledTimes(1)
  const dates = vi.mocked(onChangeDates).mock.calls[0][0]
  expect(new Date(dates.start).getTime()).toBe(new Date(2026, 10, 8).getTime())
  expect(new Date(dates.end).getTime()).toBe(new Date(2026, 10, 29).getTime())
})

test('with the modifier held the drag snaps to the hour instead of the day', () => {
  const { bar, onChangeDates } = setup()
  drag(bar, 2.4 * DAY_WIDTH, { shiftKey: true })
  const dates = vi.mocked(onChangeDates).mock.calls[0][0]
  expect(Date.parse(dates.start) - Date.parse(event.start)).toBe(58 * 3_600_000)
  expect(Date.parse(dates.end) - Date.parse(event.end)).toBe(58 * 3_600_000)
})

test('the same drag without the modifier lands on a day boundary', () => {
  const { bar, onChangeDates } = setup()
  drag(bar, 2.4 * DAY_WIDTH)
  const dates = vi.mocked(onChangeDates).mock.calls[0][0]
  expect(new Date(dates.start).getTime()).toBe(new Date(2026, 10, 7).getTime())
})

test('the bar follows the pointer while dragging and settles back if nothing is committed', () => {
  const { bar } = setup({ onChangeDates: () => {} })
  fireEvent.pointerDown(bar, { clientX: 100, pointerId: 1, button: 0 })
  fireEvent.pointerMove(bar, { clientX: 100 + 2 * DAY_WIDTH, pointerId: 1 })
  expect(bar.style.left).toBe(`${6 * DAY_WIDTH}px`)
  fireEvent.pointerCancel(bar, { pointerId: 1 })
  expect(bar.style.left).toBe(`${4 * DAY_WIDTH}px`)
  // A cancelled drag is over: further movement does nothing.
  fireEvent.pointerMove(bar, { clientX: 100 + 5 * DAY_WIDTH, pointerId: 1 })
  expect(bar.style.left).toBe(`${4 * DAY_WIDTH}px`)
})

test('the live preview also snaps to the hour while the modifier is held', () => {
  const { bar } = setup({ onChangeDates: () => {} })
  fireEvent.pointerDown(bar, { clientX: 100, pointerId: 1, button: 0 })
  fireEvent.pointerMove(bar, { clientX: 100 + 2.4 * DAY_WIDTH, pointerId: 1, shiftKey: true })
  // 58 hours on from the original left edge (4 days), against 2 whole days without the modifier.
  expect(parseFloat(bar.style.left)).toBeCloseTo((4 + 58 / 24) * DAY_WIDTH, 5)
  fireEvent.pointerMove(bar, { clientX: 100 + 2.4 * DAY_WIDTH, pointerId: 1 })
  expect(bar.style.left).toBe(`${6 * DAY_WIDTH}px`)
  fireEvent.pointerCancel(bar, { pointerId: 1 })
})

test('dragging the end handle resizes only the end, and does not move the bar', () => {
  const { bar, onChangeDates } = setup()
  drag(handle(bar, 'end'), -4 * DAY_WIDTH)
  expect(onChangeDates).toHaveBeenCalledTimes(1)
  const dates = vi.mocked(onChangeDates).mock.calls[0][0]
  expect(dates.start).toBe(event.start)
  expect(new Date(dates.end).getTime()).toBe(new Date(2026, 10, 22).getTime())
})

test('dragging the start handle resizes only the start', () => {
  const { bar, onChangeDates } = setup()
  drag(handle(bar, 'start'), 2 * DAY_WIDTH)
  expect(onChangeDates).toHaveBeenCalledTimes(1)
  const dates = vi.mocked(onChangeDates).mock.calls[0][0]
  expect(new Date(dates.start).getTime()).toBe(new Date(2026, 10, 7).getTime())
  expect(dates.end).toBe(event.end)
})

test('dragging a handle far past the other edge cannot invert the event', () => {
  const { bar, onChangeDates } = setup()
  drag(handle(bar, 'end'), -200 * DAY_WIDTH)
  const dates = vi.mocked(onChangeDates).mock.calls[0][0]
  expect(Date.parse(dates.end)).toBeGreaterThan(Date.parse(dates.start))
})

test('both handles live inside the bar, which clips overflow', () => {
  const { bar } = setup()
  expect(handle(bar, 'start').parentElement).toBe(bar)
  expect(handle(bar, 'end').parentElement).toBe(bar)
})

test('a real drag that ends over the bar does not count as a click', () => {
  const { bar, onSelect } = setup()
  drag(bar, 3 * DAY_WIDTH)
  fireEvent.click(bar)
  expect(onSelect).not.toHaveBeenCalled()
})

test('finishing a handle drag does not select the event either', () => {
  const { bar, onSelect } = setup()
  drag(handle(bar, 'end'), 2 * DAY_WIDTH)
  fireEvent.click(handle(bar, 'end'))
  expect(onSelect).not.toHaveBeenCalled()
})

test('a genuine click still selects the event', () => {
  const { bar, onSelect } = setup()
  fireEvent.pointerDown(bar, { clientX: 100, pointerId: 1, button: 0 })
  fireEvent.pointerUp(bar, { clientX: 100, pointerId: 1 })
  fireEvent.click(bar)
  expect(onSelect).toHaveBeenCalledWith('e_1')
})

test('a click with a little pointer jitter still selects the event', () => {
  const { bar, onSelect, onChangeDates } = setup()
  drag(bar, 2)
  fireEvent.click(bar)
  expect(onSelect).toHaveBeenCalledWith('e_1')
  expect(onChangeDates).not.toHaveBeenCalled()
})

test('a click after a drag is only swallowed once: the next click selects', async () => {
  const { bar, onSelect } = setup()
  drag(bar, 3 * DAY_WIDTH)
  await new Promise((resolve) => setTimeout(resolve, 5))
  fireEvent.click(bar)
  expect(onSelect).toHaveBeenCalledWith('e_1')
})

test('the right mouse button does not start a drag', () => {
  const { bar, onChangeDates } = setup()
  fireEvent.pointerDown(bar, { clientX: 100, pointerId: 1, button: 2 })
  fireEvent.pointerMove(bar, { clientX: 100 + 3 * DAY_WIDTH, pointerId: 1 })
  fireEvent.pointerUp(bar, { clientX: 100 + 3 * DAY_WIDTH, pointerId: 1 })
  expect(onChangeDates).not.toHaveBeenCalled()
})
