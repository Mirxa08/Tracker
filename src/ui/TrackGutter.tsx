import type { Project } from '../domain/schema'
import { IconButton } from './sakuga'

export function TrackGutter({
  project,
  onAdd,
}: {
  project: Project
  onAdd: (trackId: string) => void
}) {
  return (
    <div className="timeline__gutter">
      <div className="timeline__corner" />
      {project.tracks.map((track) => (
        <div key={track.id} className="track-label">
          <span className="track-label__swatch" style={{ background: track.color }} />
          <span className="track-label__name">{track.name}</span>
          <IconButton label={`Add event to ${track.name}`} onClick={() => onAdd(track.id)}>
            +
          </IconButton>
        </div>
      ))}
    </div>
  )
}
