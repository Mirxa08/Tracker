export function NowLine({ x, now }: { x: number; now: Date }) {
  const time = now.toTimeString().slice(0, 8)
  return (
    <div className="now-line" style={{ left: x }}>
      <span className="now-line__pill" data-testid="now-pill">{time}</span>
    </div>
  )
}
