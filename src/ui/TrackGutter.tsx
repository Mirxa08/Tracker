import type { Project } from '../domain/schema'

export function TrackGutter({
  project,
  onAdd,
}: {
  project: Project
  onAdd: (trackId: string) => void
}) {
  return (
    <div className="timeline__gutter">
      <div style={{ height: 'var(--header-height)' }} />
      {project.tracks.map((track) => (
        <div key={track.id} className="track-label">
          <span className="track-label__swatch" style={{ background: track.color }} />
          <span>{track.name}</span>
          <button type="button" onClick={() => onAdd(track.id)} aria-label={`Add event to ${track.name}`}>
            +
          </button>
        </div>
      ))}
    </div>
  )
}
