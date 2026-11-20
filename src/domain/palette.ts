export const TRACK_COLORS = [
  '#7a5cff', '#2f8cf6', '#e4701e', '#16a085',
  '#c0392b', '#8e44ad', '#2d7a4f', '#b7950b',
]

export function nextTrackColor(used: string[]): string {
  const unused = TRACK_COLORS.find((c) => !used.includes(c))
  return unused ?? TRACK_COLORS[used.length % TRACK_COLORS.length]
}
