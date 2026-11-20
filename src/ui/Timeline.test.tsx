import { render, screen, act } from '@testing-library/react'
import { addEvent, addTrack, createProject, projectBounds } from '../domain/project'
import { xForTime } from '../domain/time'
import { Timeline } from './Timeline'
import { useNow } from './useNow'

function seeded() {
  const now = new Date()
  let p = addTrack(createProject('Wuthering Waves'), 'Banners')
  p = addTrack(p, 'Combat')
  p = addEvent(p, {
    trackId: p.tracks[0].id,
    name: 'Lily Banner',
    start: new Date(now.getTime() - 2 * 86_400_000).toISOString(),
    end: new Date(now.getTime() + 10 * 86_400_000).toISOString(),
  })
  return p
}

test('renders a row for every track', () => {
  render(<Timeline project={seeded()} />)
  expect(screen.getByText('Banners')).toBeInTheDocument()
  expect(screen.getByText('Combat')).toBeInTheDocument()
})

test('renders month labels in the header band', () => {
  render(<Timeline project={seeded()} />)
  expect(screen.getAllByTestId('month-span').length).toBeGreaterThan(0)
})

test('renders the now-line with a ticking clock', () => {
  vi.useFakeTimers()
  try {
    render(<Timeline project={seeded()} />)
    const pill = screen.getByTestId('now-pill')
    const first = pill.textContent
    act(() => { vi.advanceTimersByTime(2000) })
    expect(pill.textContent).not.toBe(first)
    expect(pill.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  } finally {
    vi.useRealTimers()
  }
})

test('shows an empty-state hint when a project has no tracks', () => {
  render(<Timeline project={createProject('Empty')} />)
  expect(screen.getByText(/add your first track/i)).toBeInTheDocument()
})

test('now-line sits at the pixel position xForTime gives for the current instant', () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date('2026-06-15T15:30:00+01:00'))
    const project = seeded()
    render(<Timeline project={project} />)
    const now = new Date()
    const bounds = projectBounds(project, now)
    const expected = xForTime(now, bounds.start)
    const line = screen.getByTestId('now-pill').parentElement as HTMLElement
    expect(expected).toBeGreaterThan(0)
    expect(line.style.left).toBe(`${expected}px`)
  } finally {
    vi.useRealTimers()
  }
})

test('now-line moves right as time passes within a day', () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date('2026-06-15T06:00:00+01:00'))
    render(<Timeline project={seeded()} />)
    const line = screen.getByTestId('now-pill').parentElement as HTMLElement
    const before = parseFloat(line.style.left)
    act(() => { vi.advanceTimersByTime(6 * 3_600_000) })
    expect(parseFloat(line.style.left)).toBeGreaterThan(before)
  } finally {
    vi.useRealTimers()
  }
})

test('renders one empty track-row slot per track for event bars', () => {
  render(<Timeline project={seeded()} />)
  expect(screen.getAllByTestId('track-row')).toHaveLength(2)
})

test('the add button reports its track id', () => {
  const onAdd = vi.fn()
  const project = seeded()
  render(<Timeline project={project} onAddToTrack={onAdd} />)
  screen.getByRole('button', { name: 'Add event to Combat' }).click()
  expect(onAdd).toHaveBeenCalledWith(project.tracks[1].id)
})

function Clock({ ms }: { ms?: number }) {
  return <span data-testid="clock">{useNow(ms).getTime()}</span>
}

test('useNow clears its interval on unmount', () => {
  vi.useFakeTimers()
  try {
    const { unmount } = render(<Clock />)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

test('useNow honours a custom interval', () => {
  vi.useFakeTimers()
  try {
    render(<Clock ms={5000} />)
    const first = screen.getByTestId('clock').textContent
    act(() => { vi.advanceTimersByTime(4000) })
    expect(screen.getByTestId('clock').textContent).toBe(first)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByTestId('clock').textContent).not.toBe(first)
  } finally {
    vi.useRealTimers()
  }
})
