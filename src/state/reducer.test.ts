import { addEvent, addTrack, createProject } from '../domain/project'
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
