import { useState } from 'react'
import { eventsForTrack } from '../domain/project'
import type { Project, Track } from '../domain/schema'
import { Badge, IconButton, Input } from './sakuga'

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
  onRename,
}: {
  project: Project
  onAdd: (trackId: string) => void
  onToggleCollapse: (trackId: string, collapsed: boolean) => void
  onRename: (trackId: string, name: string) => void
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
          onRename={onRename}
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
  onRename,
}: {
  track: Track
  eventCount: number
  onAdd: (trackId: string) => void
  onToggleCollapse: (trackId: string, collapsed: boolean) => void
  onRename: (trackId: string, name: string) => void
}) {
  const classes = ['track-label', track.collapsed && 'track-label--collapsed']
    .filter(Boolean)
    .join(' ')

  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null

  if (editing) {
    return (
      <div className={classes} data-testid="track-label">
        <span className="track-label__swatch" style={{ background: track.color }} />
        <NameEditor
          value={draft}
          onChange={setDraft}
          onCommit={(name) => {
            setDraft(null)
            // A nameless track is not a track: an empty or blank entry keeps the old name.
            const trimmed = name.trim()
            if (trimmed && trimmed !== track.name) onRename(track.id, trimmed)
          }}
          onCancel={() => setDraft(null)}
        />
      </div>
    )
  }

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
      {/* Out of the row's layout until the row is hovered or holds focus — the gutter is
          190px and the name needs the room — but clipped rather than removed, so these
          stay focusable and tabbing to one reveals the cluster (timeline.css). */}
      <span className="track-label__actions">
        <IconButton label={`Rename ${track.name}`} onClick={() => setDraft(track.name)}>
          {'✎'}
        </IconButton>
      </span>
    </div>
  )
}

/**
 * The inline name field, shared by rename and add-track. Enter commits, Escape discards, and
 * losing focus commits.
 *
 * Escape cannot be followed by a stray commit: both it and Enter unmount the field, and
 * removing the focused element fires no blur. A guard against that blur was written first and
 * no mutation could kill it — it was unreachable — so it is gone rather than left as a branch
 * no test covers.
 */
function NameEditor({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string
  onChange: (value: string) => void
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  return (
    <Input
      autoFocus
      className="track-label__editor"
      aria-label="Track name"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onCommit(e.currentTarget.value)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
      onBlur={(e) => onCommit(e.target.value)}
    />
  )
}
