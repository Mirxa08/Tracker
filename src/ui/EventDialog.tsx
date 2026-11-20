import { useState } from 'react'
import { addEvent, updateEvent } from '../domain/project'
import type { Notes, Project } from '../domain/schema'
import { storeImageFile } from '../persistence/images'
import type { DialogState } from '../state/reducer'
import { NotesTable } from './NotesTable'
import { fromLocalInputValue, toLocalInputValue } from './datetime'
import '../styles/dialog.css'

export type EventDraft = {
  trackId: string
  name: string
  start: string
  end: string
  color?: string
  imageId?: string
  notes?: Notes
}

export type SubmittedDraft = EventDraft & { eventId?: string }

/** Apply a submitted draft: an edit updates the event in place, an add appends one. */
export function applyDraft(project: Project, draft: SubmittedDraft): Project {
  const { eventId, ...fields } = draft
  if (!eventId) return addEvent(project, fields)
  // An edit that cleared every notes column must clear the stored notes too: updateEvent
  // merges, so an absent key would silently keep the old value.
  return updateEvent(project, eventId, { ...fields, notes: fields.notes })
}

export function EventDialog({
  project,
  dialog,
  onClose,
  onSubmit,
}: {
  project: Project
  dialog: NonNullable<DialogState>
  onClose: () => void
  onSubmit: (draft: SubmittedDraft) => void
}) {
  const editing = dialog.mode === 'edit'
    ? project.events.find((e) => e.id === dialog.eventId)
    : undefined

  const [name, setName] = useState(editing?.name ?? '')
  const [trackId, setTrackId] = useState(
    editing?.trackId ?? (dialog.mode === 'add' ? dialog.trackId : undefined) ?? project.tracks[0]?.id ?? '',
  )
  const [start, setStart] = useState(toLocalInputValue(editing?.start ?? ''))
  const [end, setEnd] = useState(toLocalInputValue(editing?.end ?? ''))
  const [imageId, setImageId] = useState(editing?.imageId)
  const [notes, setNotes] = useState<Notes>(editing?.notes ?? { columns: [], rows: [] })
  // undefined means "use the chosen track's colour": the input shows that colour and the
  // draft omits `color`, so the event keeps following its track until one is picked.
  const [colorChoice, setColorChoice] = useState<string | undefined>(editing?.color)
  const [error, setError] = useState<string | null>(null)
  const trackColor = project.tracks.find((t) => t.id === trackId)?.color ?? '#000000'

  async function pickImage(file: File | undefined) {
    if (!file) return
    try {
      setImageId(await storeImageFile(file))
    } catch {
      setError('That image could not be processed.')
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Give the event a name.')
    if (!trackId) return setError('Create a track first, then add events to it.')
    if (!start) return setError('A start is required.')
    if (!end) return setError('An end is required.')
    const startIso = fromLocalInputValue(start)
    const endIso = fromLocalInputValue(end)
    if (Date.parse(endIso) <= Date.parse(startIso)) return setError('The end must be after the start.')

    const draft: SubmittedDraft = {
      trackId,
      name: name.trim(),
      start: startIso,
      end: endIso,
    }
    if (colorChoice) draft.color = colorChoice
    if (imageId) draft.imageId = imageId
    if (notes.columns.length > 0) draft.notes = notes
    if (editing) draft.eventId = editing.id
    onSubmit(draft)
  }

  return (
    <div className="dialog__backdrop" role="dialog" aria-modal="true" aria-label={editing ? 'Edit event' : 'Add event'}>
      <form className="dialog" onSubmit={submit}>
        <h2>{editing ? 'Edit event' : 'Add event'}</h2>
        {error && <p role="alert">{error}</p>}

        <label>
          Event name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label>
          Track
          <select value={trackId} onChange={(e) => setTrackId(e.target.value)}>
            {project.tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>

        <label>
          Start
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>

        <label>
          End
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>

        <label>
          Colour (optional)
          <input type="color" value={colorChoice ?? trackColor} onChange={(e) => setColorChoice(e.target.value)} />
        </label>

        <label>
          Image (optional)
          <input type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} />
        </label>

        <fieldset>
          <legend>Notes (optional)</legend>
          <NotesTable value={notes} onChange={setNotes} />
        </fieldset>

        <div className="dialog__actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  )
}
