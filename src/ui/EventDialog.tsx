import { useEffect, useRef, useState } from 'react'
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

type Field = 'name' | 'track' | 'start' | 'end' | 'image'
type FormError = { message: string; fields: Field[] }

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

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
  const [error, setError] = useState<FormError | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const fail = (message: string, ...fields: Field[]) => setError({ message, fields })
  // A message stays only while the field it blames is untouched; fixing that field clears it.
  const touched = (field: Field) =>
    setError((current) => (current && current.fields.includes(field) ? null : current))

  // Escape closes without saving. Tab stays inside the dialog, cycling at both ends, and the
  // dialog takes focus on open (and hands it back on close). Listening on the document, not
  // the form, keeps both working when a click on the backdrop has dropped focus to <body>.
  useEffect(() => {
    const form = formRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    form?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (event.defaultPrevented) return
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !form) return
      const items = [...form.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!form.contains(active)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  const trackColor = project.tracks.find((t) => t.id === trackId)?.color ?? '#000000'

  async function pickImage(file: File | undefined) {
    if (!file) return
    try {
      setImageId(await storeImageFile(file))
      touched('image')
    } catch {
      fail('That image could not be processed.', 'image')
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return fail('Give the event a name.', 'name')
    if (!trackId) return fail('Create a track first, then add events to it.', 'track')
    if (!start) return fail('A start is required.', 'start')
    if (!end) return fail('An end is required.', 'end')
    const startIso = fromLocalInputValue(start)
    const endIso = fromLocalInputValue(end)
    if (Date.parse(endIso) <= Date.parse(startIso)) return fail('The end must be after the start.', 'start', 'end')

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
      <form ref={formRef} className="dialog" onSubmit={submit}>
        <h2>{editing ? 'Edit event' : 'Add event'}</h2>
        {error && <p role="alert">{error.message}</p>}

        <label>
          Event name
          <input value={name} onChange={(e) => { setName(e.target.value); touched('name') }} />
        </label>

        <label>
          Track
          <select value={trackId} onChange={(e) => { setTrackId(e.target.value); touched('track') }}>
            {project.tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>

        <label>
          Start
          <input type="datetime-local" value={start} onChange={(e) => { setStart(e.target.value); touched('start') }} />
        </label>

        <label>
          End
          <input type="datetime-local" value={end} onChange={(e) => { setEnd(e.target.value); touched('end') }} />
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
