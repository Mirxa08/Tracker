import { addEvent, addTrack, createProject, updateEvent } from '../domain/project'
import { reducer, initialState, currentProject, type State } from './reducer'

function seeded(): State {
  let p = addTrack(createProject('Wuthering Waves'), 'Banners')
  p = addEvent(p, {
    trackId: p.tracks[0].id,
    name: 'Lily Banner',
    start: '2026-11-05T00:00:00.000Z',
    end: '2026-11-26T00:00:00.000Z',
  })
  return reducer(initialState, { type: 'loaded', projects: [p], currentId: p.id })
}

test('loaded installs projects and selects one', () => {
  const state = seeded()
  expect(state.projects).toHaveLength(1)
  expect(currentProject(state)?.name).toBe('Wuthering Waves')
})

test('currentProject is null when nothing is selected', () => {
  expect(currentProject(initialState)).toBeNull()
})

test('applyProject replaces the current project in place', () => {
  const state = seeded()
  const updated = addTrack(currentProject(state)!, 'Combat')
  const next = reducer(state, { type: 'applyProject', project: updated })
  expect(currentProject(next)!.tracks).toHaveLength(2)
  expect(next.projects).toHaveLength(1)
})

test('deleting an event records an undo entry', () => {
  const state = seeded()
  const event = currentProject(state)!.events[0]
  const next = reducer(state, { type: 'deleteEvent', eventId: event.id })
  expect(currentProject(next)!.events).toHaveLength(0)
  expect(next.undo?.label).toMatch(/Lily Banner/)
})

test('undo restores the project from before the delete', () => {
  const state = seeded()
  const event = currentProject(state)!.events[0]
  const deleted = reducer(state, { type: 'deleteEvent', eventId: event.id })
  const restored = reducer(deleted, { type: 'undo' })
  expect(currentProject(restored)!.events).toHaveLength(1)
  expect(restored.undo).toBeNull()
})

test('undo with nothing to undo is a no-op', () => {
  const state = seeded()
  expect(reducer(state, { type: 'undo' })).toEqual(state)
})

test('deleting a track records an undo entry and removes its events', () => {
  const state = seeded()
  const trackId = currentProject(state)!.tracks[0].id
  const next = reducer(state, { type: 'deleteTrack', trackId })
  expect(currentProject(next)!.tracks).toHaveLength(0)
  expect(currentProject(next)!.events).toHaveLength(0)
  expect(next.undo).not.toBeNull()
})

test('opening and closing the add dialog', () => {
  const state = seeded()
  const opened = reducer(state, { type: 'openAdd', trackId: 't_1' })
  expect(opened.dialog).toEqual({ mode: 'add', trackId: 't_1' })
  expect(reducer(opened, { type: 'closeDialog' }).dialog).toBeNull()
})

test('selecting an event and clearing the selection', () => {
  const state = seeded()
  const selected = reducer(state, { type: 'selectEvent', eventId: 'e_1' })
  expect(selected.selectedEventId).toBe('e_1')
  expect(reducer(selected, { type: 'selectEvent', eventId: null }).selectedEventId).toBeNull()
})

test('errors are recorded and dismissible', () => {
  const state = seeded()
  const failed = reducer(state, { type: 'error', message: 'Storage is full.' })
  expect(failed.error).toBe('Storage is full.')
  expect(reducer(failed, { type: 'error', message: null }).error).toBeNull()
})

test('switching project clears selection and dialog', () => {
  let state = seeded()
  const other = createProject('Other')
  state = reducer(state, { type: 'loaded', projects: [...state.projects, other], currentId: state.currentId })
  state = reducer(state, { type: 'selectEvent', eventId: 'e_1' })
  const switched = reducer(state, { type: 'selectProject', projectId: other.id })
  expect(switched.currentId).toBe(other.id)
  expect(switched.selectedEventId).toBeNull()
  expect(switched.dialog).toBeNull()
})

function twoEvents(): State {
  const p = currentProject(seeded())!
  const withSecond = addEvent(p, {
    trackId: p.tracks[0].id,
    name: 'Gacha Event',
    start: '2026-11-01T00:00:00.000Z',
    end: '2026-11-10T00:00:00.000Z',
  })
  return reducer(initialState, { type: 'loaded', projects: [withSecond], currentId: withSecond.id })
}

test('undo does not discard an edit made after the delete', () => {
  const state = twoEvents()
  const [first, second] = currentProject(state)!.events
  const deleted = reducer(state, { type: 'deleteEvent', eventId: first.id })
  const edited = updateEvent(currentProject(deleted)!, second.id, { name: 'Renamed' })
  const afterEdit = reducer(deleted, { type: 'applyProject', project: edited })
  expect(afterEdit.undo).toBeNull()
  const undone = reducer(afterEdit, { type: 'undo' })
  expect(currentProject(undone)!.events).toHaveLength(1)
  expect(currentProject(undone)!.events[0].name).toBe('Renamed')
  expect(undone).toEqual(afterEdit)
})

test('undo does not fire after switching project', () => {
  const first = currentProject(seeded())!
  const other = createProject('Other')
  const loaded = reducer(initialState, { type: 'loaded', projects: [first, other], currentId: first.id })
  const deleted = reducer(loaded, { type: 'deleteEvent', eventId: first.events[0].id })
  const switched = reducer(deleted, { type: 'selectProject', projectId: other.id })
  expect(switched.undo).toBeNull()
  const after = reducer(switched, { type: 'undo' })
  expect(after.projects.find((p) => p.id === first.id)!.events).toHaveLength(0)
  expect(after.currentId).toBe(other.id)
})

test('removing a project clears a pending undo', () => {
  const first = currentProject(seeded())!
  const other = createProject('Other')
  const loaded = reducer(initialState, { type: 'loaded', projects: [first, other], currentId: first.id })
  const deleted = reducer(loaded, { type: 'deleteEvent', eventId: first.events[0].id })
  expect(reducer(deleted, { type: 'removeProject', projectId: other.id }).undo).toBeNull()
})

test('loading projects clears a pending undo', () => {
  const state = seeded()
  const first = currentProject(state)!
  const deleted = reducer(state, { type: 'deleteEvent', eventId: first.events[0].id })
  expect(deleted.undo).not.toBeNull()
  expect(reducer(deleted, { type: 'loaded', projects: [first], currentId: first.id }).undo).toBeNull()
})

test('currentProject is null when projects exist but none is selected', () => {
  const a = createProject('A')
  const b = createProject('B')
  const state = reducer(initialState, { type: 'loaded', projects: [a, b], currentId: null })
  expect(currentProject(state)).toBeNull()
})

test('currentProject returns the selected project when there are several', () => {
  const a = createProject('A')
  const b = createProject('B')
  const state = reducer(initialState, { type: 'loaded', projects: [a, b], currentId: b.id })
  expect(currentProject(state)!.id).toBe(b.id)
})

test('selecting another project closes an open dialog', () => {
  const first = currentProject(seeded())!
  const other = createProject('Other')
  const loaded = reducer(initialState, { type: 'loaded', projects: [first, other], currentId: first.id })
  const open = reducer(loaded, { type: 'openAdd', trackId: first.tracks[0].id })
  expect(open.dialog).not.toBeNull()
  expect(reducer(open, { type: 'selectProject', projectId: other.id }).dialog).toBeNull()
})

test('removing the current project selects the first remaining project', () => {
  const a = createProject('A')
  const b = createProject('B')
  const c = createProject('C')
  const loaded = reducer(initialState, { type: 'loaded', projects: [a, b, c], currentId: b.id })
  const removed = reducer(loaded, { type: 'removeProject', projectId: b.id })
  expect(removed.projects.map((p) => p.id)).toEqual([a.id, c.id])
  expect(removed.currentId).toBe(a.id)
})

test('removing the first project while it is current selects the next one', () => {
  const a = createProject('A')
  const b = createProject('B')
  const loaded = reducer(initialState, { type: 'loaded', projects: [a, b], currentId: a.id })
  const removed = reducer(loaded, { type: 'removeProject', projectId: a.id })
  expect(removed.projects.map((p) => p.id)).toEqual([b.id])
  expect(removed.currentId).toBe(b.id)
})

test('removing the last project leaves nothing selected', () => {
  const a = createProject('A')
  const loaded = reducer(initialState, { type: 'loaded', projects: [a], currentId: a.id })
  const removed = reducer(loaded, { type: 'removeProject', projectId: a.id })
  expect(removed.projects).toEqual([])
  expect(removed.currentId).toBeNull()
  expect(currentProject(removed)).toBeNull()
})
