import type { TrackEvent } from '../domain/schema'
import { Button, IconButton, Panel } from './sakuga'
import { useImageUrl } from './useImageUrl'
import '../styles/detail.css'

function formatRange(event: TrackEvent): string {
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
  return `${new Date(event.start).toLocaleString(undefined, options)} → ${new Date(event.end).toLocaleString(undefined, options)}`
}

export function EventDetail({
  event,
  onEdit,
  onDelete,
  onClose,
}: {
  event: TrackEvent
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const imageUrl = useImageUrl(event.imageId)
  return (
    <Panel as="aside" className="detail" aria-label="Event details">
      <header className="detail__header">
        <h2>{event.name}</h2>
        <IconButton label="Close details" onClick={onClose}>&times;</IconButton>
      </header>
      {/* The event's own colour, so the panel reads as belonging to the bar that opened it. */}
      <span className="detail__accent" style={{ background: event.color }} />
      <p className="detail__range">{formatRange(event)}</p>
      {imageUrl && <img className="detail__image" src={imageUrl} alt="" />}
      {event.notes && event.notes.columns.length > 0 ? (
        <table className="detail__notes">
          <thead>
            <tr>{event.notes.columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr>
          </thead>
          <tbody>
            {event.notes.rows.map((row, i) => (
              <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="detail__empty">No notes on this event.</p>
      )}
      <div className="detail__actions">
        <Button variant="primary" onClick={() => onEdit(event.id)}>Edit</Button>
        <Button variant="danger" onClick={() => onDelete(event.id)}>Delete</Button>
      </div>
    </Panel>
  )
}
