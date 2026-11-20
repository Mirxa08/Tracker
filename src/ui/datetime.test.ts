import { toLocalInputValue, fromLocalInputValue } from './datetime'

test('formats an ISO instant for a datetime-local input', () => {
  const iso = new Date(2026, 10, 5, 9, 30).toISOString()
  expect(toLocalInputValue(iso)).toBe('2026-11-05T09:30')
})

test('round-trips an input value back to the same instant', () => {
  const value = '2026-11-05T09:30'
  expect(toLocalInputValue(fromLocalInputValue(value))).toBe(value)
})

test('a two-digit year is kept literally, never mapped to the 1900s', () => {
  const iso = fromLocalInputValue('0026-03-05T10:00')
  expect(new Date(iso).getFullYear()).toBe(26)
  expect(toLocalInputValue(iso)).toBe('0026-03-05T10:00')
})

test('summer-time input converts to the right UTC instant', () => {
  expect(fromLocalInputValue('2026-07-10T09:30')).toBe('2026-07-10T08:30:00.000Z')
  expect(toLocalInputValue('2026-07-10T08:30:00.000Z')).toBe('2026-07-10T09:30')
})

test('returns an empty string for an empty input', () => {
  expect(toLocalInputValue('')).toBe('')
})
