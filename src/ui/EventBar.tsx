import type { TrackEvent } from '../domain/schema'
import { remainingLabel, xForTime } from '../domain/time'
import { useBarDrag } from './useBarDrag'
import { useImageUrl } from './useImageUrl'
import '../styles/event-bar.css'

export function EventBar({
  event,
  viewStart,
  now,
  onSelect,
  onChangeDates,
}: {
  event: TrackEvent
  viewStart: Date
  now: Date
  onSelect: (id: string) => void
  onChangeDates?: (dates: { start: string; end: string }) => void
}) {
  const { onPointerDown, preview } = useBarDrag({ event, onCommit: onChangeDates ?? (() => {}) })
  const shown = preview ?? event
  const left = xForTime(shown.start, viewStart)
  const width = Math.max(8, xForTime(shown.end, viewStart) - left)
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
      onPointerDown={onPointerDown('move')}
    >
      {imageUrl && <img className="event-bar__image" data-testid="event-image" src={imageUrl} alt="" />}
      <span className="event-bar__name">{event.name}</span>
      {remaining && <span className="event-bar__remaining" data-testid="remaining">{remaining}</span>}
      <span className="event-bar__handle event-bar__handle--start" onPointerDown={onPointerDown('resize-start')} />
      <span className="event-bar__handle event-bar__handle--end" onPointerDown={onPointerDown('resize-end')} />
    </button>
  )
}
