import { eventsForTrack } from '../domain/project'
import type { Project, Track } from '../domain/schema'
import { Badge, IconButton } from './sakuga'

function countLabel(n: number): string {
  return n === 1 ? '1 event' : `${n} events`
}

/**
 * The left column. Every row here is the twin of a `.track-row` in the canvas, and the two
 * must be the same height: they share the rules in timeline.css (`.track-row, .track-label`),
 * so a row's height is declared once for both columns and once more for both when collapsed.
 */
export function TrackGutter({
  project,
  onAdd,
  onToggleCollapse,
}: {
  project: Project
  onAdd: (trackId: string) => void
  onToggleCollapse: (trackId: string, collapsed: boolean) => void
}) {
  return (
    <div className="timeline__gutter">
      <div className="timeline__corner" />
      {project.tracks.map((track) => (
        <TrackLabel
          key={track.id}
          track={track}
          eventCount={eventsForTrack(project, track.id).length}
          onAdd={onAdd}
          onToggleCollapse={onToggleCollapse}
        />
      ))}
    </div>
  )
}

function TrackLabel({
  track,
  eventCount,
  onAdd,
  onToggleCollapse,
}: {
  track: Track
  eventCount: number
  onAdd: (trackId: string) => void
  onToggleCollapse: (trackId: string, collapsed: boolean) => void
}) {
  const classes = ['track-label', track.collapsed && 'track-label--collapsed']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} data-testid="track-label">
      <IconButton
        label={track.collapsed ? `Expand ${track.name}` : `Collapse ${track.name}`}
        aria-expanded={!track.collapsed}
        className="track-label__chevron"
        onClick={() => onToggleCollapse(track.id, !track.collapsed)}
      >
        {track.collapsed ? '▸' : '▾'}
      </IconButton>
      <span className="track-label__swatch" style={{ background: track.color }} />
      <span className="track-label__name">{track.name}</span>
      {track.collapsed && (
        <Badge className="track-label__count" aria-label={countLabel(eventCount)}>
          {eventCount}
        </Badge>
      )}
      <IconButton label={`Add event to ${track.name}`} onClick={() => onAdd(track.id)}>
        +
      </IconButton>
    </div>
  )
}
