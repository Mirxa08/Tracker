import type { TrackEvent } from '../domain/schema'
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
    <aside className="detail" aria-label="Event details">
      <header className="detail__header">
        <h2>{event.name}</h2>
        <button type="button" onClick={onClose} aria-label="Close details">&times;</button>
      </header>
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
        <button type="button" onClick={() => onEdit(event.id)}>Edit</button>
        <button type="button" onClick={() => onDelete(event.id)}>Delete</button>
      </div>
    </aside>
  )
}
