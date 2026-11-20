import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addEvent, addTrack, createProject } from '../domain/project'
import { applyDraft, EventDialog } from './EventDialog'

function seeded() {
  let p = addTrack(createProject('Wuthering Waves'), 'Banners')
  p = addEvent(p, {
    trackId: p.tracks[0].id,
    name: 'Lily Banner',
    start: new Date(2026, 10, 5).toISOString(),
    end: new Date(2026, 10, 26).toISOString(),
  })
  return p
}

test('refuses to submit without a name', async () => {
  const onSubmit = vi.fn()
  render(<EventDialog project={seeded()} dialog={{ mode: 'add' }} onClose={() => {}} onSubmit={onSubmit} />)
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent(/name/i)
  expect(screen.getByRole('alert')).not.toHaveTextContent(/start|end/i)
})

test('refuses to submit when the end is not after the start', async () => {
  const onSubmit = vi.fn()
  render(<EventDialog project={seeded()} dialog={{ mode: 'add' }} onClose={() => {}} onSubmit={onSubmit} />)
  await userEvent.type(screen.getByLabelText(/event name/i), 'Test')
  await userEvent.type(screen.getByLabelText(/^start/i), '2026-11-10T00:00')
  await userEvent.type(screen.getByLabelText(/^end/i), '2026-11-09T00:00')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent(/after/i)
  expect(screen.getByRole('alert')).toHaveTextContent(/end/i)
  expect(screen.getByRole('alert')).not.toHaveTextContent(/name/i)
})

test('rejects an end equal to the start', async () => {
  const onSubmit = vi.fn()
  render(<EventDialog project={seeded()} dialog={{ mode: 'add' }} onClose={() => {}} onSubmit={onSubmit} />)
  await userEvent.type(screen.getByLabelText(/event name/i), 'Test')
  await userEvent.type(screen.getByLabelText(/^start/i), '2026-11-10T00:00')
  await userEvent.type(screen.getByLabelText(/^end/i), '2026-11-10T00:00')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent(/end must be after/i)
})

test('accepts an end one minute after the start', async () => {
  const onSubmit = vi.fn()
  render(<EventDialog project={seeded()} dialog={{ mode: 'add' }} onClose={() => {}} onSubmit={onSubmit} />)
  await userEvent.type(screen.getByLabelText(/event name/i), 'Test')
  await userEvent.type(screen.getByLabelText(/^start/i), '2026-11-10T00:00')
  await userEvent.type(screen.getByLabelText(/^end/i), '2026-11-10T00:01')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).toHaveBeenCalledTimes(1)
})

test('names the start field when only the start is missing', async () => {
  const onSubmit = vi.fn()
  render(<EventDialog project={seeded()} dialog={{ mode: 'add' }} onClose={() => {}} onSubmit={onSubmit} />)
  await userEvent.type(screen.getByLabelText(/event name/i), 'Test')
  await userEvent.type(screen.getByLabelText(/^end/i), '2026-11-10T00:00')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent(/start/i)
  expect(screen.getByRole('alert')).not.toHaveTextContent(/end/i)
})

test('names the end field when only the end is missing', async () => {
  const onSubmit = vi.fn()
  render(<EventDialog project={seeded()} dialog={{ mode: 'add' }} onClose={() => {}} onSubmit={onSubmit} />)
  await userEvent.type(screen.getByLabelText(/event name/i), 'Test')
  await userEvent.type(screen.getByLabelText(/^start/i), '2026-11-10T00:00')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent(/end/i)
  expect(screen.getByRole('alert')).not.toHaveTextContent(/start/i)
})

test('a whitespace-only name is treated as empty', async () => {
  const onSubmit = vi.fn()
  render(<EventDialog project={seeded()} dialog={{ mode: 'add' }} onClose={() => {}} onSubmit={onSubmit} />)
  await userEvent.type(screen.getByLabelText(/event name/i), '   ')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent(/name/i)
})

test('submits a valid new event', async () => {
  const onSubmit = vi.fn()
  const project = seeded()
  render(<EventDialog project={project} dialog={{ mode: 'add' }} onClose={() => {}} onSubmit={onSubmit} />)
  await userEvent.type(screen.getByLabelText(/event name/i), 'Azure Oath')
  await userEvent.type(screen.getByLabelText(/^start/i), '2026-12-01T00:00')
  await userEvent.type(screen.getByLabelText(/^end/i), '2026-12-21T00:00')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Azure Oath',
    trackId: project.tracks[0].id,
  }))
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('eventId')
})

test('submits against the track chosen in the select', async () => {
  const onSubmit = vi.fn()
  const project = addTrack(seeded(), 'Combat')
  render(<EventDialog project={project} dialog={{ mode: 'add' }} onClose={() => {}} onSubmit={onSubmit} />)
  await userEvent.type(screen.getByLabelText(/event name/i), 'Boss')
  await userEvent.selectOptions(screen.getByLabelText(/^track/i), 'Combat')
  await userEvent.type(screen.getByLabelText(/^start/i), '2026-12-01T00:00')
  await userEvent.type(screen.getByLabelText(/^end/i), '2026-12-02T00:00')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit.mock.calls[0][0].trackId).toBe(project.tracks[1].id)
})

test('preselects the track the dialog was opened for', () => {
  const project = addTrack(seeded(), 'Combat')
  render(<EventDialog project={project} dialog={{ mode: 'add', trackId: project.tracks[1].id }} onClose={() => {}} onSubmit={() => {}} />)
  expect(screen.getByLabelText(/^track/i)).toHaveValue(project.tracks[1].id)
})

test('pre-fills the form when editing an existing event', () => {
  const project = seeded()
  render(
    <EventDialog
      project={project}
      dialog={{ mode: 'edit', eventId: project.events[0].id }}
      onClose={() => {}}
      onSubmit={() => {}}
    />,
  )
  expect(screen.getByLabelText(/event name/i)).toHaveValue('Lily Banner')
  expect(screen.getByLabelText(/^start/i)).toHaveValue('2026-11-05T00:00')
  expect(screen.getByLabelText(/^end/i)).toHaveValue('2026-11-26T00:00')
})

test('submitting an edit carries the id of the event being edited', async () => {
  const onSubmit = vi.fn()
  const project = seeded()
  render(
    <EventDialog
      project={project}
      dialog={{ mode: 'edit', eventId: project.events[0].id }}
      onClose={() => {}}
      onSubmit={onSubmit}
    />,
  )
  await userEvent.type(screen.getByLabelText(/event name/i), ' 2')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    eventId: project.events[0].id,
    name: 'Lily Banner 2',
  }))
})

test('applying an edit draft updates the event in place instead of adding another', () => {
  const project = seeded()
  const id = project.events[0].id
  const next = applyDraft(project, { eventId: id, trackId: project.tracks[0].id, name: 'Renamed', start: project.events[0].start, end: project.events[0].end })
  expect(next.events).toHaveLength(1)
  expect(next.events[0].id).toBe(id)
  expect(next.events[0].name).toBe('Renamed')
})

test('applying an add draft appends a new event', () => {
  const project = seeded()
  const next = applyDraft(project, { trackId: project.tracks[0].id, name: 'Another', start: new Date(2026, 11, 1).toISOString(), end: new Date(2026, 11, 2).toISOString() })
  expect(next.events).toHaveLength(2)
  expect(next.events.map((e) => e.name)).toEqual(['Lily Banner', 'Another'])
})

test('clearing every notes column on edit removes the stored notes', () => {
  let project = seeded()
  const id = project.events[0].id
  project = { ...project, events: [{ ...project.events[0], notes: { columns: ['A'], rows: [['x']] } }] }
  const next = applyDraft(project, { eventId: id, trackId: project.tracks[0].id, name: 'Lily Banner', start: project.events[0].start, end: project.events[0].end })
  expect(next.events[0].notes).toBeUndefined()
})

test('adds and removes notes columns and rows', async () => {
  render(<EventDialog project={seeded()} dialog={{ mode: 'add' }} onClose={() => {}} onSubmit={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /add column/i }))
  await userEvent.click(screen.getByRole('button', { name: /add row/i }))
  expect(screen.getAllByRole('columnheader')).toHaveLength(2) // the column + the remove-row control column
  expect(screen.getAllByRole('row')).toHaveLength(2) // header + one body row
  await userEvent.click(screen.getByRole('button', { name: /remove row/i }))
  expect(screen.getAllByRole('row')).toHaveLength(1)
})

test('the notes table round-trips what was typed, including empty cells', async () => {
  const onSubmit = vi.fn()
  render(<EventDialog project={seeded()} dialog={{ mode: 'add' }} onClose={() => {}} onSubmit={onSubmit} />)
  await userEvent.type(screen.getByLabelText(/event name/i), 'Notes')
  await userEvent.type(screen.getByLabelText(/^start/i), '2026-12-01T00:00')
  await userEvent.type(screen.getByLabelText(/^end/i), '2026-12-02T00:00')

  await userEvent.click(screen.getByRole('button', { name: /add column/i }))
  await userEvent.click(screen.getByRole('button', { name: /add column/i }))
  await userEvent.click(screen.getByRole('button', { name: /add row/i }))
  await userEvent.click(screen.getByRole('button', { name: /add row/i }))

  await userEvent.clear(screen.getByLabelText('Column 1 name'))
  await userEvent.type(screen.getByLabelText('Column 1 name'), 'Resource')
  await userEvent.clear(screen.getByLabelText('Column 2 name'))
  await userEvent.type(screen.getByLabelText('Column 2 name'), 'Left')
  await userEvent.type(screen.getByLabelText('Resource for row 1'), 'Shell credits')
  await userEvent.type(screen.getByLabelText('Left for row 1'), '40')
  // row 2: first cell empty, last cell filled
  await userEvent.type(screen.getByLabelText('Left for row 2'), '7')

  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit.mock.calls[0][0].notes).toEqual({
    columns: ['Resource', 'Left'],
    rows: [['Shell credits', '40'], ['', '7']],
  })
})

test('a column added after rows exist gets an empty cell in every existing row', async () => {
  const onSubmit = vi.fn()
  render(<EventDialog project={seeded()} dialog={{ mode: 'add' }} onClose={() => {}} onSubmit={onSubmit} />)
  await userEvent.type(screen.getByLabelText(/event name/i), 'Notes')
  await userEvent.type(screen.getByLabelText(/^start/i), '2026-12-01T00:00')
  await userEvent.type(screen.getByLabelText(/^end/i), '2026-12-02T00:00')
  await userEvent.click(screen.getByRole('button', { name: /add column/i }))
  await userEvent.click(screen.getByRole('button', { name: /add row/i }))
  await userEvent.click(screen.getByRole('button', { name: /add column/i }))
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit.mock.calls[0][0].notes).toEqual({
    columns: ['Column 1', 'Column 2'],
    rows: [['', '']],
  })
})

test('closes without submitting on cancel', async () => {
  const onClose = vi.fn()
  const onSubmit = vi.fn()
  render(<EventDialog project={seeded()} dialog={{ mode: 'add' }} onClose={onClose} onSubmit={onSubmit} />)
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
  expect(onClose).toHaveBeenCalled()
  expect(onSubmit).not.toHaveBeenCalled()
})
