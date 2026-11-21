import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react'
import { eventsForTrack, projectBounds } from '../domain/project'
import type { Project } from '../domain/schema'
import { DAY_WIDTH, dayColumns, monthSpans, xForTime } from '../domain/time'
import { EventBar } from './EventBar'
import { HeaderBands } from './HeaderBands'
import { NowLine } from './NowLine'
import { AddTrack, TrackGutter } from './TrackGutter'
import { useNow } from './useNow'
import '../styles/timeline.css'

/** The only per-second component: the tick re-renders this and nothing else. */
function NowMarker({ viewStart }: { viewStart: Date }) {
  const now = useNow()
  return <NowLine x={xForTime(now, viewStart)} now={now} />
}

// Hoisted: a fresh default per render would hand every bar a new prop.
const noop = () => {}

export type TimelineHandle = { scrollToNow: () => void }

export function Timeline({
  ref,
  project,
  onAddToTrack = noop,
  onSelectEvent = noop,
  onToggleCollapse = noop,
  onRenameTrack = noop,
  onReorderTracks = noop,
  onDeleteTrack = noop,
  addingTrack = false,
  onAddingTrackChange = noop,
  onCreateTrack = noop,
  onChangeDates,
}: {
  ref?: Ref<TimelineHandle>
  project: Project
  onAddToTrack?: (trackId: string) => void
  onSelectEvent?: (eventId: string) => void
  onToggleCollapse?: (trackId: string, collapsed: boolean) => void
  onRenameTrack?: (trackId: string, name: string) => void
  onReorderTracks?: (orderedIds: string[]) => void
  onDeleteTrack?: (trackId: string) => void
  /** The add-track field is the caller's state: the project bar's button opens this one. */
  addingTrack?: boolean
  onAddingTrackChange?: (open: boolean) => void
  onCreateTrack?: (name: string) => void
  onChangeDates?: (eventId: string, dates: { start: string; end: string }) => void
}) {
  // The coarse minute tick is deliberate: it is only needed to roll the view over at
  // midnight. The per-second clock lives in NowMarker so bars and day columns are not
  // re-rendered every second.
  const today = useNow(60_000)
  const dayKey = today.toDateString()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `today` is only read for its calendar day
  const bounds = useMemo(() => projectBounds(project, today), [project, dayKey])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const days = useMemo(() => dayColumns(bounds.start, bounds.end, today), [bounds, dayKey])
  const months = useMemo(() => monthSpans(days), [days])
  const width = days.length * DAY_WIDTH

  const viewport = useRef<HTMLDivElement>(null)
  const hasTracks = project.tracks.length > 0

  // Puts the now-line a third of the way across the visible canvas: the viewport minus the
  // sticky gutter that covers its left edge.
  const scrollToNow = (behavior: ScrollBehavior) => {
    const el = viewport.current
    if (!el) return
    const gutterWidth = el.querySelector<HTMLElement>('.timeline__gutter')?.offsetWidth ?? 0
    el.scrollTo?.({
      left: Math.max(0, xForTime(new Date(), bounds.start) - (el.clientWidth - gutterWidth) / 3),
      behavior,
    })
  }
  const scrollToNowRef = useRef(scrollToNow)
  scrollToNowRef.current = scrollToNow
  useImperativeHandle(ref, () => ({ scrollToNow: () => scrollToNowRef.current('smooth') }), [])

  // Open at today. The viewport only exists once there is a track, so this re-runs when the
  // first track appears and when another project is shown.
  useEffect(() => { scrollToNowRef.current('auto') }, [hasTracks, project.id])

  if (!hasTracks) {
    // The gutter is not rendered yet, so the add-track field is offered here instead:
    // otherwise the only way to leave this state would be the project bar's button.
    return (
      <div className="timeline__empty">
        <p className="timeline__empty-text">
          No tracks yet — add your first track to start building this timeline.
        </p>
        <AddTrack open={addingTrack} onOpenChange={onAddingTrackChange} onCreate={onCreateTrack} />
      </div>
    )
  }

  return (
    <div className="timeline__viewport" ref={viewport}>
      <div className="timeline" style={{ ['--day-width' as string]: `${DAY_WIDTH}px` }}>
        <TrackGutter
          project={project}
          onAdd={onAddToTrack}
          onToggleCollapse={onToggleCollapse}
          onRename={onRenameTrack}
          onReorder={onReorderTracks}
          onDelete={onDeleteTrack}
          addingTrack={addingTrack}
          onAddingTrackChange={onAddingTrackChange}
          onCreateTrack={onCreateTrack}
        />
        <div className="timeline__scroll">
          <div className="timeline__canvas" style={{ width }}>
            <HeaderBands days={days} months={months} />
            <NowMarker viewStart={bounds.start} />
            {project.tracks.map((track) => (
              <div
                key={track.id}
                className={['track-row', track.collapsed && 'track-row--collapsed'].filter(Boolean).join(' ')}
                data-testid="track-row"
              >
                {!track.collapsed && eventsForTrack(project, track.id).map((event) => (
                  <EventBar
                    key={event.id}
                    event={event}
                    viewStart={bounds.start}
                    now={today}
                    onSelect={onSelectEvent}
                    onChangeDates={onChangeDates && ((dates) => onChangeDates(event.id, dates))}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
