function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** ISO instant -> the `YYYY-MM-DDTHH:mm` a datetime-local input expects, in local time. */
export function toLocalInputValue(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The value of a datetime-local input (local time) -> an ISO instant. */
export function fromLocalInputValue(value: string): string {
  if (!value) return ''
  const [date, time] = value.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm).toISOString()
}
