import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { addTrack, createProject } from '../domain/project'
import type { Project } from '../domain/schema'
import * as db from '../persistence/db'
import { currentProject, initialState, type Action, type State } from './reducer'
import { StoreProvider, useStore } from './StoreProvider'

vi.mock('../persistence/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../persistence/db')>()
  return {
    ...actual,
    listProjects: vi.fn(actual.listProjects),
    putProject: vi.fn(actual.putProject),
    deleteProject: vi.fn(actual.deleteProject),
  }
})

const DEBOUNCE_MS = 300
const project = addTrack(createProject('Timeline'), 'Banners')
const other = createProject('Other')

let dispatch: (action: Action) => void = () => {}
let latest: State = initialState
function Probe() {
  const store = useStore()
  dispatch = store.dispatch
  latest = store.state
  return null
}

// The real module, bypassing the mock, so assertions read what actually reached IndexedDB.
function storage() {
  return vi.importActual<typeof import('../persistence/db')>('../persistence/db')
}

async function resetStorage() {
  const real = await storage()
  for (const p of await real.listProjects()) await real.deleteProject(p.id)
}

function writes() {
  return vi.mocked(db.putProject).mock.calls.map((call) => call[0])
}

async function mount(projects: Project[] = [project]) {
  vi.mocked(db.listProjects).mockResolvedValue(projects)
  const view = render(<StoreProvider><Probe /></StoreProvider>)
  // Let listProjects resolve and the loaded action commit.
  await act(async () => {})
  // The load schedules its own debounced save; let it fire, then forget it.
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS) })
  vi.mocked(db.putProject).mockClear()
  return view
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  await resetStorage()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('a mutation results in exactly one write after the debounce window', async () => {
  await mount()
  act(() => dispatch({ type: 'applyProject', project: addTrack(project, 'Combat') }))
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS - 1) })
  expect(db.putProject).not.toHaveBeenCalled()
  act(() => { vi.advanceTimersByTime(1) })
  expect(writes()).toHaveLength(1)
  expect(writes()[0].tracks.map((t) => t.name)).toEqual(['Banners', 'Combat'])
})

test('rapid dispatches collapse into one write holding the latest project', async () => {
  await mount()
  let next = project
  for (const name of ['Combat', 'Story', 'Gacha']) {
    next = addTrack(next, name)
    act(() => dispatch({ type: 'applyProject', project: next }))
    act(() => { vi.advanceTimersByTime(100) })
  }
  expect(db.putProject).not.toHaveBeenCalled()
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS) })
  expect(writes()).toHaveLength(1)
  expect(writes()[0].tracks.map((t) => t.name)).toEqual(['Banners', 'Combat', 'Story', 'Gacha'])
})

test('unmounting persists a write that is still pending', async () => {
  const view = await mount()
  act(() => dispatch({ type: 'applyProject', project: addTrack(project, 'Combat') }))
  act(() => { vi.advanceTimersByTime(100) })
  view.unmount()
  expect(writes()).toHaveLength(1)
  expect(writes()[0].tracks).toHaveLength(2)
  // The pending timer was consumed by the flush, so nothing fires later.
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS) })
  expect(writes()).toHaveLength(1)
  // The write really reached storage, not just the mock.
  await vi.mocked(db.putProject).mock.results[0].value
  expect((await (await storage()).getProject(project.id))?.tracks).toHaveLength(2)
})

test('switching project inside the debounce window still saves the edited project', async () => {
  await mount([project, other])
  act(() => dispatch({ type: 'applyProject', project: addTrack(project, 'Combat') }))
  act(() => { vi.advanceTimersByTime(100) })
  act(() => dispatch({ type: 'selectProject', projectId: other.id }))
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS) })
  await Promise.all(vi.mocked(db.putProject).mock.results.map((r) => r.value))
  const real = await storage()
  expect((await real.getProject(project.id))?.tracks).toHaveLength(2)
  expect(await real.getProject(other.id)).toBeDefined()
})

test('a failed storage open leaves an in-memory project so the session stays usable', async () => {
  vi.mocked(db.listProjects).mockRejectedValueOnce(
    new db.StorageError('Storage is unavailable in private browsing.'),
  )
  render(<StoreProvider><Probe /></StoreProvider>)
  await act(async () => {})
  expect(latest.error).toBe('Storage is unavailable in private browsing.')
  const session = currentProject(latest)
  expect(session).not.toBeNull()
  act(() => dispatch({ type: 'applyProject', project: addTrack(session!, 'Combat') }))
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS) })
  expect(db.putProject).not.toHaveBeenCalled()
})

test('removing a project deletes its stored row and a pending edit does not resurrect it', async () => {
  await mount([project, other])
  const real = await storage()
  expect(await real.getProject(project.id)).toBeDefined()
  act(() => dispatch({ type: 'applyProject', project: addTrack(project, 'Combat') }))
  act(() => dispatch({ type: 'removeProject', projectId: project.id }))
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS) })
  await Promise.all(vi.mocked(db.deleteProject).mock.results.map((r) => r.value))
  expect(await real.getProject(project.id)).toBeUndefined()
  expect(await real.getProject(other.id)).toBeDefined()
})
