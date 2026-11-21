import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { eventsForTrack } from '../domain/project'
import type { Project, Track } from '../domain/schema'
import { Badge, Button, IconButton, Input, Panel } from './sakuga'
import '../styles/dialog.css'

function countLabel(n: number): string {
  return n === 1 ? '1 event' : `${n} events`
}

/** What the confirmation says is going with the track. */
function eventsSentence(n: number): string {
  if (n === 0) return 'It has no events.'
  if (n === 1) return 'Its one event goes with it.'
  return `Its ${n} events go with it.`
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
  onDelete,
  addingTrack,
  onAddingTrackChange,
  onCreateTrack,
}: {
  project: Project
  onAdd: (trackId: string) => void
  onToggleCollapse: (trackId: string, collapsed: boolean) => void
  onRename: (trackId: string, name: string) => void
  onReorder: (orderedIds: string[]) => void
  onDelete: (trackId: string) => void
  addingTrack: boolean
  onAddingTrackChange: (open: boolean) => void
  onCreateTrack: (name: string) => void
}) {
  const gutter = useRef<HTMLDivElement>(null)
  const handles = useRef(new Map<string, HTMLButtonElement | null>())
  const [announcement, setAnnouncement] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
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
  const confirmedTrack = tracks.find((t) => t.id === confirming) ?? null
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
          onDelete={setConfirming}
          onHandleKeyDown={onHandleKeyDown(index)}
          onHandlePointerDown={onHandlePointerDown(index)}
        />
      ))}
      <AddTrack open={addingTrack} onOpenChange={onAddingTrackChange} onCreate={onCreateTrack} />
      {confirmedTrack && (
        <ConfirmDelete
          track={confirmedTrack}
          eventCount={eventsForTrack(project, confirmedTrack.id).length}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setConfirming(null)
            onDelete(confirmedTrack.id)
          }}
        />
      )}
      {/* Reordering is otherwise silent for anyone who cannot see the rows move. aria-live
          without role="status": the app's undo line is the page's one status role, and a
          second one would make "the status message" ambiguous to a screen reader and to a
          test asking for it. */}
      <div
        className="track-gutter__live"
        aria-live="polite"
        data-testid="track-order-status"
      >
        {announcement}
      </div>
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
  onDelete,
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
  onDelete: (trackId: string) => void
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
      {/* Hidden until the row is hovered or holds focus, and then drawn OVER the right end of
          the row rather than inside its layout: the gutter is 190px, and three controls taking
          their own space would leave the name a few pixels wide at rest. Clipped rather than
          removed, so they stay focusable and tabbing to one reveals the cluster
          (timeline.css). */}
      <span className="track-label__actions">
        <IconButton label={`Add event to ${track.name}`} onClick={() => onAdd(track.id)}>
          +
        </IconButton>
        <IconButton label={`Rename ${track.name}`} onClick={() => setDraft(track.name)}>
          {'✎'}
        </IconButton>
        <IconButton label={`Delete ${track.name}`} onClick={() => onDelete(track.id)}>
          {'×'}
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
  onCommit: (value: string, reason: 'enter' | 'blur') => void
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
          onCommit(e.currentTarget.value, 'enter')
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
      onBlur={(e) => onCommit(e.target.value, 'blur')}
    />
  )
}

/**
 * Creating a track. This replaces a `window.prompt`, which returns null and throws uncaught in
 * browsers and embedded webviews that block prompts — so the one way to add a track could fail
 * outright. Same rules as rename: Enter commits, Escape discards, blur commits, and a blank
 * name creates nothing.
 *
 * `open` is the caller's, because the project bar's "Add track" button opens this same field
 * rather than keeping a prompt of its own, and because it has to be reachable when there are
 * no tracks at all and the gutter is not on screen.
 */
export function AddTrack({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string) => void
}) {
  const [draft, setDraft] = useState('')
  const close = () => {
    setDraft('')
    onOpenChange(false)
  }
  return (
    <div className="track-add">
      {open
        ? (
          <NameEditor
            value={draft}
            onChange={setDraft}
            onCommit={(value, reason) => {
              const trimmed = value.trim()
              // Enter on an empty field leaves it open and waiting; clicking away closes it.
              if (!trimmed) {
                if (reason === 'blur') close()
                return
              }
              close()
              onCreate(trimmed)
            }}
            onCancel={close}
          />
        )
        : (
          // "New track", not "Add track": the project bar's button opens this same field, and
          // two controls with one name is ambiguous to a screen reader and to a test.
          <Button onClick={() => onOpenChange(true)}>New track</Button>
        )}
    </div>
  )
}

/**
 * The delete confirmation: it names the track and says the events go with it, because the
 * canvas may be scrolled away from them and "delete" alone does not say how much.
 *
 * Rendered into document.body rather than into the gutter. The gutter is a z-index 40 sticky
 * layer and so a stacking context of its own, which would trap this backdrop's z-index 70
 * inside it and let the corner (50) and the detail panel (60) paint over a modal.
 */
function ConfirmDelete({
  track,
  eventCount,
  onConfirm,
  onCancel,
}: {
  track: Track
  eventCount: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const titleId = useId()
  const panel = useRef<HTMLElement>(null)
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel

  // Escape closes, the dialog takes focus on open and hands it back on close, and Tab cycles
  // within it: a modal that lets Tab wander behind the backdrop is not modal.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const buttons = () => [...(panel.current?.querySelectorAll<HTMLElement>('button') ?? [])]
    buttons()[0]?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = buttons()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      opener?.focus()
    }
  }, [])

  return createPortal(
    <div className="dialog__backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <Panel as="section" className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <h2 className="dialog__title" id={titleId}>Delete “{track.name}”?</h2>
        <p className="dialog__prose">
          {eventsSentence(eventCount)} You can undo this straight afterwards.
        </p>
        <div className="dialog__actions">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Delete track</Button>
        </div>
      </Panel>
    </div>,
    document.body,
  )
}
