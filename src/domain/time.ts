export const DAY_WIDTH = 34
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function asDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Whole calendar days from `from` to `to`. Both are normalised to local
 * midnight and compared as UTC civil dates, so a 23- or 25-hour DST day still
 * counts as exactly one day.
 */
export function dayIndex(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b - a) / MS_PER_DAY)
}

function fractionOfDay(d: Date): number {
  return (d.getTime() - startOfDay(d).getTime()) / MS_PER_DAY
}

export function xForTime(t: string | Date, viewStart: Date): number {
  const date = asDate(t)
  return (dayIndex(viewStart, date) + fractionOfDay(date)) * DAY_WIDTH
}

export function timeForX(x: number, viewStart: Date): Date {
  const days = x / DAY_WIDTH
  const whole = Math.floor(days)
  const base = startOfDay(viewStart)
  const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + whole)
  return new Date(day.getTime() + (days - whole) * MS_PER_DAY)
}

export type DayColumn = {
  date: Date
  x: number
  weekday: string
  day: string
  isToday: boolean
  isWeekend: boolean
}

export function dayColumns(viewStart: Date, viewEnd: Date, now: Date = new Date()): DayColumn[] {
  const count = dayIndex(viewStart, viewEnd) + 1
  const base = startOfDay(viewStart)
  const today = startOfDay(now).getTime()
  const columns: DayColumn[] = []
  for (let i = 0; i < count; i += 1) {
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
    const weekday = date.getDay()
    columns.push({
      date,
      x: i * DAY_WIDTH,
      weekday: WEEKDAYS[weekday],
      day: String(date.getDate()),
      isToday: date.getTime() === today,
      isWeekend: weekday === 0 || weekday === 6,
    })
  }
  return columns
}

export type MonthSpan = { key: string; label: string; x: number; width: number }

export function monthSpans(days: DayColumn[]): MonthSpan[] {
  const spans: MonthSpan[] = []
  for (const column of days) {
    const key = `${column.date.getFullYear()}-${column.date.getMonth()}`
    const last = spans[spans.length - 1]
    if (last && last.key === key) {
      last.width += DAY_WIDTH
    } else {
      spans.push({
        key,
        label: MONTHS[column.date.getMonth()],
        x: column.x,
        width: DAY_WIDTH,
      })
    }
  }
  return spans
}

/**
 * Time left until `end`, as the compact badge shown at a bar's right edge.
 * Returns null once the event has ended.
 */
export function remainingLabel(end: string | Date, now: Date): string | null {
  const ms = asDate(end).getTime() - now.getTime()
  if (ms <= 0) return null
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${Math.max(1, minutes)}m`
  const hours = Math.floor(ms / MS_PER_HOUR)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(ms / MS_PER_DAY)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}
