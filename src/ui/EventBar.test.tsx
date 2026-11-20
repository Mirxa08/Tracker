import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TrackEvent } from '../domain/schema'
import { DAY_WIDTH } from '../domain/time'
import { EventBar } from './EventBar'

const imageOverride = vi.hoisted(() => ({ fn: null as null | ((id: string) => Promise<string | null>) }))

vi.mock('../persistence/images', async () => {
  const actual = await vi.importActual<typeof import('../persistence/images')>('../persistence/images')
  return {
    ...actual,
    imageObjectUrl: (id: string) => (imageOverride.fn ? imageOverride.fn(id) : actual.imageObjectUrl(id)),
  }
})

afterEach(() => {
  imageOverride.fn = null
})

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

test('positions and sizes the bar from its dates', () => {
  render(<EventBar event={event} viewStart={viewStart} now={now} onSelect={() => {}} />)
  const bar = screen.getByRole('button', { name: /Lily Banner/ })
  expect(bar.style.left).toBe(`${4 * DAY_WIDTH}px`)
  expect(bar.style.width).toBe(`${21 * DAY_WIDTH}px`)
})

test('positions fractional times from the same mapping as the now-line', () => {
  const ev = {
    ...event,
    start: new Date(2026, 10, 5, 12, 0).toISOString(),
    end: new Date(2026, 10, 7, 18, 0).toISOString(),
  }
  render(<EventBar event={ev} viewStart={viewStart} now={now} onSelect={() => {}} />)
  const bar = screen.getByRole('button', { name: /Lily Banner/ })
  expect(bar.style.left).toBe(`${4.5 * DAY_WIDTH}px`)
  expect(bar.style.width).toBe(`${2.25 * DAY_WIDTH}px`)
})

test('shows the time remaining until the event ends', () => {
  render(<EventBar event={event} viewStart={viewStart} now={now} onSelect={() => {}} />)
  expect(screen.getByTestId('remaining')).toHaveTextContent('15d')
})

test('omits the badge and dims the bar once the event has ended', () => {
  const past = { ...event, end: new Date(2026, 10, 9).toISOString() }
  render(<EventBar event={past} viewStart={viewStart} now={now} onSelect={() => {}} />)
  expect(screen.queryByTestId('remaining')).toBeNull()
  expect(screen.getByRole('button', { name: /Lily Banner/ })).toHaveClass('event-bar--ended')
})

test('badge boundary: ending in a minute shows a badge, ended a minute ago does not', () => {
  const soon = { ...event, end: new Date(now.getTime() + 60_000).toISOString() }
  const { unmount } = render(<EventBar event={soon} viewStart={viewStart} now={now} onSelect={() => {}} />)
  expect(screen.getByTestId('remaining')).toHaveTextContent('1m')
  expect(screen.getByRole('button', { name: /Lily Banner/ })).not.toHaveClass('event-bar--ended')
  unmount()
  const gone = { ...event, end: new Date(now.getTime() - 60_000).toISOString() }
  render(<EventBar event={gone} viewStart={viewStart} now={now} onSelect={() => {}} />)
  expect(screen.queryByTestId('remaining')).toBeNull()
  expect(screen.getByRole('button', { name: /Lily Banner/ })).toHaveClass('event-bar--ended')
})

test('an event that has not started is full strength with the upcoming fill', () => {
  const future = {
    ...event,
    start: new Date(2026, 10, 12).toISOString(),
    end: new Date(2026, 10, 20).toISOString(),
  }
  render(<EventBar event={future} viewStart={viewStart} now={now} onSelect={() => {}} />)
  const bar = screen.getByRole('button', { name: /Lily Banner/ })
  expect(bar).toHaveClass('event-bar--upcoming')
  expect(bar).not.toHaveClass('event-bar--ended')
})

test('a running event is neither upcoming nor ended', () => {
  render(<EventBar event={event} viewStart={viewStart} now={now} onSelect={() => {}} />)
  const bar = screen.getByRole('button', { name: /Lily Banner/ })
  expect(bar).not.toHaveClass('event-bar--upcoming')
  expect(bar).not.toHaveClass('event-bar--ended')
})

test('calls onSelect with the event id when clicked', async () => {
  const onSelect = vi.fn()
  render(<EventBar event={event} viewStart={viewStart} now={now} onSelect={onSelect} />)
  await userEvent.click(screen.getByRole('button', { name: /Lily Banner/ }))
  expect(onSelect).toHaveBeenCalledWith('e_1')
})

test('renders without an image when the event has none', () => {
  render(<EventBar event={event} viewStart={viewStart} now={now} onSelect={() => {}} />)
  expect(screen.queryByTestId('event-image')).toBeNull()
})

test('renders the image when the stored blob resolves', async () => {
  imageOverride.fn = async () => 'blob:fake-url'
  render(<EventBar event={{ ...event, imageId: 'img_1' }} viewStart={viewStart} now={now} onSelect={() => {}} />)
  const img = await screen.findByTestId('event-image')
  expect(img).toHaveAttribute('src', 'blob:fake-url')
})

test('a missing image renders a plain bar without throwing or an <img>', async () => {
  const lookups: string[] = []
  const real = await vi.importActual<typeof import('../persistence/images')>('../persistence/images')
  imageOverride.fn = (id) => {
    lookups.push(id)
    return real.imageObjectUrl(id)
  }
  render(<EventBar event={{ ...event, imageId: 'img_missing' }} viewStart={viewStart} now={now} onSelect={() => {}} />)
  await waitFor(() => expect(lookups).toEqual(['img_missing']))
  await new Promise((r) => setTimeout(r, 20))
  expect(screen.getByRole('button', { name: /Lily Banner/ })).toBeInTheDocument()
  expect(screen.queryByTestId('event-image')).toBeNull()
  expect(document.querySelector('img')).toBeNull()
})

test('revokes the object URL on unmount', async () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  imageOverride.fn = async () => 'blob:fake-url'
  const { unmount } = render(<EventBar event={{ ...event, imageId: 'img_1' }} viewStart={viewStart} now={now} onSelect={() => {}} />)
  await screen.findByTestId('event-image')
  unmount()
  expect(revoke).toHaveBeenCalledWith('blob:fake-url')
  revoke.mockRestore()
})

test('a rejecting image lookup is swallowed and renders a plain bar', async () => {
  let called = false
  imageOverride.fn = () => {
    called = true
    return Promise.reject(new Error('idb exploded'))
  }
  render(<EventBar event={{ ...event, imageId: 'img_1' }} viewStart={viewStart} now={now} onSelect={() => {}} />)
  await waitFor(() => expect(called).toBe(true))
  await new Promise((r) => setTimeout(r, 20))
  expect(screen.getByRole('button', { name: /Lily Banner/ })).toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()
})
