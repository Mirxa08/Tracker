
import { Profiler } from 'react'
import { render, screen, act } from '@testing-library/react'
import { addEvent, addTrack, createProject, projectBounds } from '../domain/project'
import { DAY_WIDTH, dayColumns, monthSpans, xForTime, type DayColumn } from '../domain/time'
import { HeaderBands } from './HeaderBands'
import { Timeline } from './Timeline'
import { useNow } from './useNow'

const headerCommits = vi.hoisted(() => ({ count: 0 }))

// Wrap the real (memoised) HeaderBands in a Profiler: it only reports a commit when the
// memoised component actually re-renders, so the count is the header's real render count.
vi.mock('./HeaderBands', async () => {
  const actual = await vi.importActual<typeof import('./HeaderBands')>('./HeaderBands')
  return {
    HeaderBands: (props: React.ComponentProps<typeof actual.HeaderBands>) => (
      <Profiler id="header" onRender={() => { headerCommits.count += 1 }}>
        <actual.HeaderBands {...props} />
      </Profiler>
    ),
  }
})

const barCommits = vi.hoisted(() => ({ count: 0 }))

// Profiler around the real EventBar: onRender fires only when a bar's subtree commits.
vi.mock('./EventBar', async () => {
  const actual = await vi.importActual<typeof import('./EventBar')>('./EventBar')
  return {
    EventBar: (props: React.ComponentProps<typeof actual.EventBar>) => (
      <Profiler id="bar" onRender={() => { barCommits.count += 1 }}>
        <actual.EventBar {...props} />
      </Profiler>
    ),
  }
})

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

test('event bars render inside their own track row only', () => {
  render(<Timeline project={seeded()} />)
  const [banners, combat] = screen.getAllByTestId('track-row')
  expect(banners.querySelectorAll('.event-bar')).toHaveLength(1)
  expect(banners).toHaveTextContent('Lily Banner')
  expect(combat.querySelectorAll('.event-bar')).toHaveLength(0)
})

test('event bars do not re-render on the per-second tick but do on the minute tick', () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date('2026-06-15T12:00:00+01:00'))
    render(<Timeline project={seeded()} />)
    const afterMount = barCommits.count
    expect(afterMount).toBeGreaterThan(0)
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(barCommits.count).toBe(afterMount)
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(barCommits.count).toBeGreaterThan(afterMount)
  } finally {
    vi.useRealTimers()
  }
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

test('a clock tick moves the now-line but does not re-render the header bands', () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date('2026-06-15T12:00:00+01:00'))
    render(<Timeline project={seeded()} />)
    const pill = screen.getByTestId('now-pill')
    const line = pill.parentElement as HTMLElement
    const commitsAfterMount = headerCommits.count
    const xBefore = parseFloat(line.style.left)
    const textBefore = pill.textContent
    act(() => { vi.advanceTimersByTime(5000) })
    expect(pill.textContent).not.toBe(textBefore)
    expect(parseFloat(line.style.left)).toBeGreaterThan(xBefore)
    expect(headerCommits.count).toBe(commitsAfterMount)
  } finally {
    vi.useRealTimers()
  }
})

test('header bands do re-render when the project range changes', () => {
  const project = seeded()
  const { rerender } = render(<Timeline project={project} />)
  const before = headerCommits.count
  const wider = addEvent(project, {
    trackId: project.tracks[0].id,
    name: 'Far future',
    start: new Date(Date.now() + 200 * 86_400_000).toISOString(),
    end: new Date(Date.now() + 210 * 86_400_000).toISOString(),
  })
  rerender(<Timeline project={wider} />)
  expect(headerCommits.count).toBeGreaterThan(before)
})

test('now-line position is exact across the spring-forward DST transition', () => {
  vi.useFakeTimers()
  try {
    // Europe/London: clocks jump 01:00 -> 02:00 on 2026-03-29, a 23-hour day.
    vi.setSystemTime(new Date('2026-04-02T12:00:00+01:00'))
    let project = addTrack(createProject('DST'), 'Banners')
    project = addEvent(project, {
      trackId: project.tracks[0].id,
      name: 'Straddles the change',
      start: '2026-03-25T00:00:00.000Z',
      end: '2026-04-05T00:00:00.000Z',
    })
    render(<Timeline project={project} />)
    const now = new Date()
    const { start } = projectBounds(project, now)
    // Independent expectation: whole calendar days via UTC civil dates, plus 12:00 = half a day.
    const calendarDays = Math.round(
      (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
        - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000,
    )
    const expected = (calendarDays + 0.5) * DAY_WIDTH
    expect(xForTime(now, start)).toBe(expected)
    const line = screen.getByTestId('now-pill').parentElement as HTMLElement
    expect(line.style.left).toBe(`${expected}px`)
  } finally {
    vi.useRealTimers()
  }
})

describe('HeaderBands memoisation', () => {
  function columns() {
    const start = new Date(2026, 5, 1)
    const days = dayColumns(start, new Date(2026, 5, 5), start)
    return { days, months: monthSpans(days) }
  }

  // `days.map` runs once per render of the inner component, so a spy on it counts real renders.
  function counted(days: DayColumn[]) {
    const copy = [...days]
    const spy = vi.fn(copy.map.bind(copy))
    Object.defineProperty(copy, 'map', { value: spy })
    return { copy, spy }
  }

  test('does not re-render when the parent re-renders with the same props', () => {
    const { days, months } = columns()
    const { copy, spy } = counted(days)
    const { rerender } = render(<HeaderBands days={copy} months={months} />)
    expect(spy).toHaveBeenCalledTimes(1)
    rerender(<HeaderBands days={copy} months={months} />)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('re-renders when the days change', () => {
    const { days, months } = columns()
    const first = counted(days)
    const { rerender } = render(<HeaderBands days={first.copy} months={months} />)
    const second = counted(days)
    rerender(<HeaderBands days={second.copy} months={months} />)
    expect(second.spy).toHaveBeenCalledTimes(1)
  })
})
