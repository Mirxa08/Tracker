import { toLocalInputValue, fromLocalInputValue } from './datetime'

test('formats an ISO instant for a datetime-local input', () => {
  const iso = new Date(2026, 10, 5, 9, 30).toISOString()
  expect(toLocalInputValue(iso)).toBe('2026-11-05T09:30')
})

test('round-trips an input value back to the same instant', () => {
  const value = '2026-11-05T09:30'
  expect(toLocalInputValue(fromLocalInputValue(value))).toBe(value)
})

test('returns an empty string for an empty input', () => {
  expect(toLocalInputValue('')).toBe('')
})
