import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { addTrack, createProject } from '../domain/project'
import * as db from '../persistence/db'
import type { Action } from './reducer'
import { StoreProvider, useStore } from './StoreProvider'

vi.mock('../persistence/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../persistence/db')>()
  return {
    ...actual,
    listProjects: vi.fn(actual.listProjects),
    putProject: vi.fn(actual.putProject),
  }
})

const DEBOUNCE_MS = 300
const project = addTrack(createProject('Timeline'), 'Banners')

let dispatch: (action: Action) => void = () => {}
function Probe() {
  dispatch = useStore().dispatch
  return null
}

function writes() {
  return vi.mocked(db.putProject).mock.calls.map((call) => call[0])
}

async function mount() {
  vi.mocked(db.listProjects).mockResolvedValue([project])
  const view = render(<StoreProvider><Probe /></StoreProvider>)
  // Let listProjects resolve and the loaded action commit.
  await act(async () => {})
  // The load schedules its own debounced save; let it fire, then forget it.
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS) })
  vi.mocked(db.putProject).mockClear()
  return view
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
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
  const actual = await vi.importActual<typeof import('../persistence/db')>('../persistence/db')
  expect((await actual.getProject(project.id))?.tracks).toHaveLength(2)
})
