import { useMemo } from 'react'
import { projectBounds } from '../domain/project'
import type { Project } from '../domain/schema'
import { DAY_WIDTH, dayColumns, monthSpans, xForTime } from '../domain/time'
import { HeaderBands } from './HeaderBands'
import { NowLine } from './NowLine'
import { TrackGutter } from './TrackGutter'
import { useNow } from './useNow'
import '../styles/timeline.css'

/** The only per-second component: the tick re-renders this and nothing else. */
function NowMarker({ viewStart }: { viewStart: Date }) {
  const now = useNow()
  return <NowLine x={xForTime(now, viewStart)} now={now} />
}

export function Timeline({
  project,
  onAddToTrack = () => {},
}: {
  project: Project
  onAddToTrack?: (trackId: string) => void
}) {
  // Coarse clock: only needed to roll the view over at midnight. The second-by-second
  // clock lives in NowMarker so bars and day columns are not re-rendered every tick.
  const today = useNow(60_000)
  const dayKey = today.toDateString()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `today` is only read for its calendar day
  const bounds = useMemo(() => projectBounds(project, today), [project, dayKey])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const days = useMemo(() => dayColumns(bounds.start, bounds.end, today), [bounds, dayKey])
  const months = useMemo(() => monthSpans(days), [days])
  const width = days.length * DAY_WIDTH

  if (project.tracks.length === 0) {
    return <p className="timeline__empty">No tracks yet — add your first track to start building this timeline.</p>
  }

  return (
    <div className="timeline__viewport">
      <div className="timeline" style={{ ['--day-width' as string]: `${DAY_WIDTH}px` }}>
        <TrackGutter project={project} onAdd={onAddToTrack} />
        <div className="timeline__scroll">
          <div className="timeline__canvas" style={{ width }}>
            <HeaderBands days={days} months={months} />
            <NowMarker viewStart={bounds.start} />
            {project.tracks.map((track) => (
              <div key={track.id} className="track-row" data-testid="track-row" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
