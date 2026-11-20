import { useMemo } from 'react'
import { projectBounds } from '../domain/project'
import type { Project } from '../domain/schema'
import { DAY_WIDTH, dayColumns, monthSpans, xForTime } from '../domain/time'
import { HeaderBands } from './HeaderBands'
import { NowLine } from './NowLine'
import { TrackGutter } from './TrackGutter'
import { useNow } from './useNow'
import '../styles/timeline.css'

export function Timeline({
  project,
  onAddToTrack = () => {},
}: {
  project: Project
  onAddToTrack?: (trackId: string) => void
}) {
  const now = useNow()
  const bounds = useMemo(() => projectBounds(project, now), [project, now.toDateString()])
  const days = useMemo(() => dayColumns(bounds.start, bounds.end, now), [bounds, now.toDateString()])
  const months = useMemo(() => monthSpans(days), [days])
  const width = days.length * DAY_WIDTH

  if (project.tracks.length === 0) {
    return <p className="timeline__empty">No tracks yet — add your first track to start building this timeline.</p>
  }

  return (
    <div className="timeline" style={{ ['--day-width' as string]: `${DAY_WIDTH}px` }}>
      <TrackGutter project={project} onAdd={onAddToTrack} />
      <div className="timeline__scroll">
        <div className="timeline__canvas" style={{ width }}>
          <HeaderBands days={days} months={months} />
          <NowLine x={xForTime(now, bounds.start)} now={now} />
          {project.tracks.map((track) => (
            <div key={track.id} className="track-row" data-testid="track-row" />
          ))}
        </div>
      </div>
    </div>
  )
}
