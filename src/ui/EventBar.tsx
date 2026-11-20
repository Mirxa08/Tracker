import type { TrackEvent } from '../domain/schema'
import { remainingLabel, xForTime } from '../domain/time'
import { useImageUrl } from './useImageUrl'
import '../styles/event-bar.css'

export function EventBar({
  event,
  viewStart,
  now,
  onSelect,
}: {
  event: TrackEvent
  viewStart: Date
  now: Date
  onSelect: (id: string) => void
}) {
  const left = xForTime(event.start, viewStart)
  const width = Math.max(8, xForTime(event.end, viewStart) - left)
  const remaining = remainingLabel(event.end, now)
  const imageUrl = useImageUrl(event.imageId)
  const ended = remaining === null
  const upcoming = !ended && Date.parse(event.start) > now.getTime()
  const classes = ['event-bar', ended && 'event-bar--ended', upcoming && 'event-bar--upcoming']
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      style={{ left, width, background: event.color }}
      onClick={() => onSelect(event.id)}
    >
      {imageUrl && <img className="event-bar__image" data-testid="event-image" src={imageUrl} alt="" />}
      <span className="event-bar__name">{event.name}</span>
      {remaining && <span className="event-bar__remaining" data-testid="remaining">{remaining}</span>}
    </button>
  )
}
