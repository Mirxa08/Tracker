import {
  DAY_WIDTH, startOfDay, dayIndex, xForTime, timeForX, dayColumns, monthSpans, remainingLabel,
} from './time'

const viewStart = new Date(2026, 10, 1) // 1 November 2026, local

// vite.config.ts pins TZ to Europe/London so offset bugs surface. That pin was once inert
// because every datetime fixture sat in a month when London is UTC. If it is removed or
// changed, this fails loudly instead of the suite quietly losing its teeth.
test('the test run is pinned to Europe/London, where July is BST (UTC+1)', () => {
  // No @types/node in this project, so reach the Node global through a typed cast.
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
  expect(env.TZ).toBe('Europe/London')
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/London')
  const midsummer = new Date('2026-07-01T12:00:00.000Z')
  expect(midsummer.getTimezoneOffset()).toBe(-60)
  expect(midsummer.getHours()).toBe(13)
  // And winter is genuinely UTC, so the two seasons really do differ.
  expect(new Date('2026-01-15T12:00:00.000Z').getTimezoneOffset()).toBe(0)
})

test('startOfDay strips the time of day', () => {
  expect(startOfDay(new Date(2026, 10, 5, 13, 45, 30)).getTime())
    .toBe(new Date(2026, 10, 5).getTime())
})

test('dayIndex counts whole calendar days', () => {
  expect(dayIndex(viewStart, new Date(2026, 10, 1))).toBe(0)
  expect(dayIndex(viewStart, new Date(2026, 10, 5))).toBe(4)
  expect(dayIndex(viewStart, new Date(2026, 11, 1))).toBe(30)
})

test('dayIndex is unaffected by daylight-saving transitions', () => {
  // Most northern-hemisphere zones shift clocks in late March and late October.
  const march = new Date(2026, 2, 1)
  expect(dayIndex(march, new Date(2026, 3, 1))).toBe(31)
  const october = new Date(2026, 9, 1)
  expect(dayIndex(october, new Date(2026, 10, 1))).toBe(31)
})

test('xForTime places midnight on a column boundary', () => {
  expect(xForTime(new Date(2026, 10, 1), viewStart)).toBe(0)
  expect(xForTime(new Date(2026, 10, 2), viewStart)).toBe(DAY_WIDTH)
})

test('xForTime places midday half way through a column', () => {
  expect(xForTime(new Date(2026, 10, 1, 12), viewStart)).toBeCloseTo(DAY_WIDTH / 2, 5)
})

test('timeForX round-trips with xForTime', () => {
  const t = new Date(2026, 10, 9, 8, 30)
  const back = timeForX(xForTime(t, viewStart), viewStart)
  expect(Math.abs(back.getTime() - t.getTime())).toBeLessThan(60_000)
})

test('dayColumns covers the range inclusively and marks today and weekends', () => {
  const now = new Date(2026, 10, 3, 9, 0)
  const days = dayColumns(new Date(2026, 10, 1), new Date(2026, 10, 7), now)
  expect(days).toHaveLength(7)
  expect(days[0].x).toBe(0)
  expect(days[1].x).toBe(DAY_WIDTH)
  expect(days[2].isToday).toBe(true)
  expect(days[0].isToday).toBe(false)
  expect(days.filter((d) => d.isWeekend)).toHaveLength(2)
  expect(days[0].day).toBe('1')
})

test('dayColumns crosses a year boundary', () => {
  const days = dayColumns(new Date(2026, 11, 30), new Date(2027, 0, 2))
  expect(days.map((d) => d.day)).toEqual(['30', '31', '1', '2'])
})

test('monthSpans groups columns into labelled months', () => {
  const days = dayColumns(new Date(2026, 10, 28), new Date(2026, 11, 3))
  const spans = monthSpans(days)
  expect(spans).toHaveLength(2)
  expect(spans[0].label).toBe('November')
  expect(spans[0].width).toBe(3 * DAY_WIDTH)
  expect(spans[1].label).toBe('December')
  expect(spans[1].x).toBe(3 * DAY_WIDTH)
})

test('remainingLabel formats days, months and hours', () => {
  const now = new Date(2026, 10, 20, 12, 0)
  expect(remainingLabel(new Date(2026, 11, 6, 12, 0), now)).toBe('16d')
  expect(remainingLabel(new Date(2026, 11, 20, 12, 0), now)).toBe('1mo')
  expect(remainingLabel(new Date(2026, 10, 20, 17, 0), now)).toBe('5h')
  expect(remainingLabel(new Date(2026, 10, 20, 12, 30), now)).toBe('30m')
})

test('remainingLabel returns null once the event has ended', () => {
  const now = new Date(2026, 10, 20, 12, 0)
  expect(remainingLabel(new Date(2026, 10, 19), now)).toBeNull()
})

describe('remainingLabel boundaries', () => {
  // Pure elapsed time from fixed UTC instants, so no daylight-saving shift can move an edge.
  const now = new Date(Date.UTC(2026, 6, 1, 12, 0, 0))
  const MIN = 60_000
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR
  const left = (ms: number) => remainingLabel(new Date(now.getTime() + ms), now)

  test('end == now is over, one millisecond left is still 1m', () => {
    expect(left(0)).toBeNull()
    expect(left(-1)).toBeNull()
    expect(left(1)).toBe('1m')
  })

  test('minutes roll to hours at exactly 60m', () => {
    expect(left(59 * MIN)).toBe('59m')
    expect(left(60 * MIN - 1)).toBe('59m')
    expect(left(60 * MIN)).toBe('1h')
  })

  test('hours roll to days at exactly 24h', () => {
    expect(left(24 * HOUR - 1)).toBe('23h')
    expect(left(24 * HOUR)).toBe('1d')
  })

  test('days roll to months at exactly 30d', () => {
    expect(left(30 * DAY - 1)).toBe('29d')
    expect(left(30 * DAY)).toBe('1mo')
    expect(left(60 * DAY)).toBe('2mo')
  })
})
