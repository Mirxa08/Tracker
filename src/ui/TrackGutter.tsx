import { useEffect, useRef, useState } from 'react'
import { eventsForTrack } from '../domain/project'
import type { Project, Track } from '../domain/schema'
import { Badge, IconButton, Input } from './sakuga'

function countLabel(n: number): string {
  return n === 1 ? '1 event' : `${n} events`
}

/** `ids` with the entry at `from` lifted out and dropped at `to`. */
export function movedOrder(ids: string[], from: number, to: number): string[] {
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, moved)
  return next
}

/**
 * The row index a pointer at `y` is over: the first row whose middle it has not passed, and
 * the last row once it is past them all. Rows may differ in height (a collapsed one is
 * slimmer), so each box is measured rather than assumed.
 */
export function dropIndex(boxes: readonly { top: number; height: number }[], y: number): number {
  for (let i = 0; i < boxes.length; i += 1) {
    if (y < boxes[i].top + boxes[i].height / 2) return i
  }
  return boxes.length - 1
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
  onReorder,
}: {
  project: Project
  onAdd: (trackId: string) => void
  onToggleCollapse: (trackId: string, collapsed: boolean) => void
  onRename: (trackId: string, name: string) => void
  onReorder: (orderedIds: string[]) => void
}) {
  const gutter = useRef<HTMLDivElement>(null)
  const handles = useRef(new Map<string, HTMLButtonElement | null>())
  const [announcement, setAnnouncement] = useState('')
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null)
  // A reorder re-renders the whole gutter with the rows in a new order; keyboard reordering
  // is only usable if the handle keeps focus, so the moved track's handle is focused again
  // after the commit and a second press continues from there.
  const refocus = useRef<string | null>(null)
  useEffect(() => {
    const id = refocus.current
    if (!id) return
    refocus.current = null
    // Moving a focused element can blur it, and the keyboard path depends on it not doing so.
    handles.current.get(id)?.focus()
  })

  const tracks = project.tracks
  const commitMove = (from: number, to: number) => {
    if (to === from || to < 0 || to >= tracks.length) return
    const track = tracks[from]
    refocus.current = track.id
    onReorder(movedOrder(tracks.map((t) => t.id), from, to))
    setAnnouncement(`${track.name} moved to position ${to + 1} of ${tracks.length}`)
  }

  // Alt is the modifier: a bare ArrowUp/ArrowDown on a focused control is how a screen
  // reader user walks the page, and must not be stolen to move the track under it.
  const onHandleKeyDown = (index: number) => (event: React.KeyboardEvent) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    commitMove(index, index + (event.key === 'ArrowUp' ? -1 : 1))
  }

  const onHandlePointerDown = (index: number) => (event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    const target = event.currentTarget as HTMLElement
    const pointerId = event.pointerId
    if (typeof target.setPointerCapture === 'function') target.setPointerCapture(pointerId)
    // Measured once, at the start: the rows do not move during the drag, only the preview.
    const boxes = [...(gutter.current?.querySelectorAll<HTMLElement>('.track-label') ?? [])]
      .map((el) => {
        const rect = el.getBoundingClientRect()
        return { top: rect.top, height: rect.height }
      })
    let to = index
    setDrag({ id: tracks[index].id, to })

    const finish = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', cancel)
      if (typeof target.releasePointerCapture === 'function' && target.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture(pointerId)
      }
      setDrag(null)
    }
    const move = (ev: PointerEvent) => {
      to = dropIndex(boxes, ev.clientY)
      setDrag({ id: tracks[index].id, to })
    }
    const up = (ev: PointerEvent) => {
      to = dropIndex(boxes, ev.clientY)
      finish()
      commitMove(index, to)
    }
    const cancel = () => finish()

    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', cancel)
  }

  return (
    <div className="timeline__gutter" ref={gutter}>
      <div className="timeline__corner" />
      {tracks.map((track, index) => (
        <TrackLabel
          key={track.id}
          track={track}
          index={index}
          total={tracks.length}
          eventCount={eventsForTrack(project, track.id).length}
          dragging={drag?.id === track.id}
          dropTarget={drag !== null && drag.id !== track.id && drag.to === index}
          handleRef={(el) => { handles.current.set(track.id, el) }}
          onAdd={onAdd}
          onToggleCollapse={onToggleCollapse}
          onRename={onRename}
          onHandleKeyDown={onHandleKeyDown(index)}
          onHandlePointerDown={onHandlePointerDown(index)}
        />
      ))}
      {/* Reordering is otherwise silent for anyone who cannot see the rows move. */}
      <div className="track-gutter__live" role="status" aria-live="polite">{announcement}</div>
    </div>
  )
}

function TrackLabel({
  track,
  index,
  total,
  eventCount,
  dragging,
  dropTarget,
  handleRef,
  onAdd,
  onToggleCollapse,
  onRename,
  onHandleKeyDown,
  onHandlePointerDown,
}: {
  track: Track
  index: number
  total: number
  eventCount: number
  dragging: boolean
  dropTarget: boolean
  handleRef: (el: HTMLButtonElement | null) => void
  onAdd: (trackId: string) => void
  onToggleCollapse: (trackId: string, collapsed: boolean) => void
  onRename: (trackId: string, name: string) => void
  onHandleKeyDown: (event: React.KeyboardEvent) => void
  onHandlePointerDown: (event: React.PointerEvent) => void
}) {
  const classes = [
    'track-label',
    track.collapsed && 'track-label--collapsed',
    dragging && 'track-label--dragging',
    dropTarget && 'track-label--drop',
  ]
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
        ref={handleRef}
        label={`Reorder ${track.name}, position ${index + 1} of ${total}`}
        className="track-label__handle"
        onKeyDown={onHandleKeyDown}
        onPointerDown={onHandlePointerDown}
      >
        {'⠇'}
      </IconButton>
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
