import { useEffect, useRef, type CSSProperties } from 'react'
import type { TrackEvent } from '../domain/schema'
import { remainingLabel, xForTime } from '../domain/time'
import { Badge, land, spark, spotlightProps, trail } from './sakuga'
import { useBarDrag } from './useBarDrag'
import { useImageUrl } from './useImageUrl'
import '../styles/event-bar.css'

export function EventBar({
  event,
  viewStart,
  now,
  justCreated = false,
  onSelect,
  onChangeDates,
}: {
  event: TrackEvent
  viewStart: Date
  now: Date
  /** True for the one bar the last Save created: it bursts in rather than appearing. */
  justCreated?: boolean
  onSelect: (id: string) => void
  onChangeDates?: (dates: { start: string; end: string }) => void
}) {
  const { onPointerDown, preview } = useBarDrag({ event, onCommit: onChangeDates ?? (() => {}) })
  const node = useRef<HTMLButtonElement>(null)
  const shown = preview ?? event
  const left = xForTime(shown.start, viewStart)
  const width = Math.max(8, xForTime(shown.end, viewStart) - left)
  const remaining = remainingLabel(event.end, now)
  const imageUrl = useImageUrl(event.imageId)
  const ended = remaining === null
  const upcoming = !ended && Date.parse(event.start) > now.getTime()
  // A bar is a single <button>, so it borrows the spotlight directly rather than nesting a
  // SpotlightSurface inside itself.
  const spotlight = spotlightProps(
    ['event-bar', ended && 'event-bar--ended', upcoming && 'event-bar--upcoming']
      .filter(Boolean)
      .join(' '),
  )
  // --bar-color drives the outer glow in the event's own colour (event-bar.css), so tracks
  // stay distinguishable at a glance.
  const style = { left, width, background: event.color, ['--bar-color']: event.color } as CSSProperties

  // A new bar bursts in with a sparkle. Keyed on the flag rather than on mount, so a bar
  // that merely scrolled into view, or re-rendered on the minute tick, stays still.
  useEffect(() => {
    if (justCreated) spark(node.current)
  }, [justCreated])

  // Speed lines while it is being dragged, and the impact ring when it is set down.
  // `preview` is non-null for exactly the duration of a drag, so its edges are the drag's.
  const wasDragging = useRef(false)
  useEffect(() => {
    if (preview) {
      // Throttled in fx.ts: a pointermove storm must not become an effect storm.
      trail(node.current, Date.parse(preview.start) >= Date.parse(event.start) ? 'right' : 'left')
    } else if (wasDragging.current) {
      land(node.current)
    }
    wasDragging.current = preview !== null
  })

  return (
    <button
      ref={node}
      type="button"
      className={spotlight.className}
      style={style}
      onClick={() => onSelect(event.id)}
      onPointerDown={onPointerDown('move')}
      onMouseMove={spotlight.onMouseMove}
    >
      {upcoming && <span className="event-bar__wash" />}
      {imageUrl && <img className="event-bar__image" data-testid="event-image" src={imageUrl} alt="" />}
      <span className="event-bar__name">{event.name}</span>
      {remaining && <Badge className="event-bar__remaining" data-testid="remaining">{remaining}</Badge>}
      <span className="event-bar__handle event-bar__handle--start" onPointerDown={onPointerDown('resize-start')} />
      <span className="event-bar__handle event-bar__handle--end" onPointerDown={onPointerDown('resize-end')} />
    </button>
  )
}
