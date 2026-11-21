import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { addEvent, addTrack, createProject } from '../domain/project'
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
    deleteImage: vi.fn(actual.deleteImage),
    getFlag: vi.fn(actual.getFlag),
    setFlag: vi.fn(actual.setFlag),
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
  const db = await real.openDb()
  await db.clear('images')
  await db.clear('meta')
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

// ---- First run ---------------------------------------------------------------------------
// The visible half of "the app looked like it did nothing": with empty storage it used to
// seed an EMPTY project, so a new visitor got a toolbar and the words "No tracks yet" —
// no bars, no now-line crossing anything, nothing to animate.

/**
 * Mount with genuinely empty storage, as a brand-new visitor has. The seeding path awaits
 * the flag, the write and the flag write, so it takes several microtask turns: flushed
 * until a project arrives rather than a fixed number of times, which was flaky.
 */
async function firstRun() {
  vi.mocked(db.listProjects).mockResolvedValue([])
  const view = render(<StoreProvider><Probe /></StoreProvider>)
  for (let turn = 0; turn < 20 && currentProject(latest) === null; turn += 1) {
    await act(async () => {})
  }
  expect(currentProject(latest), 'the load never settled').not.toBeNull()
  return view
}

test('a brand-new visitor gets the example project, with tracks and bars on screen', async () => {
  await firstRun()
  const seeded = currentProject(latest)!
  expect(seeded.name).toBe('Example timeline')
  expect(seeded.tracks.length).toBeGreaterThan(1)
  expect(seeded.events.length).toBeGreaterThan(3)
  // Something is running right now, which is what puts the now-line across a bar and a
  // countdown badge on screen.
  const now = Date.now()
  expect(seeded.events.some((e) => Date.parse(e.start) <= now && Date.parse(e.end) > now)).toBe(true)
  // And it reached storage, so a reload shows the same thing rather than a second example.
  await act(async () => { await Promise.all(vi.mocked(db.putProject).mock.results.map((r) => r.value)) })
  expect((await (await storage()).listProjects()).map((p) => p.name)).toEqual(['Example timeline'])
})

test('deleting everything and reloading does not hand the example back', async () => {
  await firstRun()
  await act(async () => {
    await Promise.all(vi.mocked(db.putProject).mock.results.map((r) => r.value))
    await Promise.all(vi.mocked(db.setFlag).mock.results.map((r) => r.value))
  })
  // The marker outlives the project, which is the whole point of keeping it out of the
  // projects store: demo content that comes back after you delete it is infuriating.
  expect(await (await storage()).getFlag('exampleOffered')).toBe(true)

  cleanup()
  vi.mocked(db.putProject).mockClear()
  const real = await storage()
  for (const p of await real.listProjects()) await real.deleteProject(p.id)

  await firstRun()
  const second = currentProject(latest)!
  expect(second.name).toBe('My Timeline')
  expect(second.tracks).toEqual([])
  expect(second.events).toEqual([])
})

test('a flag that cannot be written costs a repeated example, not a lost project', async () => {
  vi.mocked(db.setFlag).mockRejectedValueOnce(new db.StorageError('No room.'))
  await firstRun()
  expect(currentProject(latest)!.name).toBe('Example timeline')
  expect(latest.error).toBeNull()
  await act(async () => { await Promise.all(vi.mocked(db.putProject).mock.results.map((r) => r.value)) })
  expect((await (await storage()).listProjects())).toHaveLength(1)
})

test('a flag that cannot be read is treated as a first run rather than failing the load', async () => {
  vi.mocked(db.getFlag).mockRejectedValueOnce(new db.StorageError('Unreadable.'))
  await firstRun()
  expect(currentProject(latest)!.name).toBe('Example timeline')
  expect(latest.error).toBeNull()
})

test('a private-browsing session, where storage never opens, still gets the example', async () => {
  vi.mocked(db.listProjects).mockRejectedValueOnce(
    new db.StorageError('Storage is unavailable in private browsing.'),
  )
  render(<StoreProvider><Probe /></StoreProvider>)
  await act(async () => {})
  const session = currentProject(latest)!
  expect(session.name).toBe('Example timeline')
  expect(session.events.length).toBeGreaterThan(3)
  // It is told that nothing will be saved, and nothing is: not the project, not the flag.
  expect(latest.error).toBe('Storage is unavailable in private browsing.')
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS) })
  expect(db.putProject).not.toHaveBeenCalled()
  expect(db.setFlag).not.toHaveBeenCalled()
  // ...and the session is usable: an edit applies, it just does not persist.
  act(() => dispatch({ type: 'applyProject', project: addTrack(session, 'Combat') }))
  expect(currentProject(latest)!.tracks).toHaveLength(3)
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS) })
  expect(db.putProject).not.toHaveBeenCalled()
})

test('storage that already holds a project is loaded untouched, example or not', async () => {
  await mount([project])
  expect(currentProject(latest)!.name).toBe('Timeline')
  expect(db.getFlag).not.toHaveBeenCalled()
  expect(db.setFlag).not.toHaveBeenCalled()
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

// ---- Image sweep ------------------------------------------------------------------------
// Image records are global (one store, keyed by image id only), so these tests seed several
// projects and assert on what survives, not just on what is removed.

const blob = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })

async function seedImage(id: string) {
  await (await storage()).putImage({ id, blob: blob(), width: 1, height: 1 })
}

async function imageIds(): Promise<string[]> {
  return ((await (await storage()).openDb()).getAllKeys('images')).then((keys) => keys.map(String).sort())
}

function withImageEvent(base: Project, imageId: string, name = 'Banner'): Project {
  return addEvent(base, {
    trackId: base.tracks[0].id,
    name,
    start: '2026-07-05T08:00:00.000Z',
    end: '2026-07-09T08:00:00.000Z',
    imageId,
  })
}

/** Let the debounced write land, then the sweep it triggers and every deletion it starts. */
async function settle() {
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS) })
  await act(async () => {
    await Promise.all(vi.mocked(db.putProject).mock.results.map((r) => r.value))
    await Promise.resolve()
    await Promise.all(vi.mocked(db.deleteImage).mock.results.map((r) => r.value))
  })
}

test('the sweep keeps an image that an event still references', async () => {
  const live = withImageEvent(project, 'img_live')
  await seedImage('img_live')
  await mount([live])
  // An unrelated edit to the same project triggers a write, and so a sweep.
  act(() => dispatch({ type: 'applyProject', project: addTrack(live, 'Combat') }))
  await settle()
  expect(db.putProject).toHaveBeenCalled()
  expect(db.deleteImage).not.toHaveBeenCalled()
  expect(await imageIds()).toEqual(['img_live'])
})

test('deleting an event removes its image once the undo window has passed', async () => {
  const live = withImageEvent(project, 'img_gone')
  await seedImage('img_gone')
  await mount([live])
  act(() => dispatch({ type: 'deleteEvent', eventId: live.events[0].id }))
  await settle()
  // The undo entry still holds the event, so its image must survive for undo to work.
  expect(await imageIds()).toEqual(['img_gone'])
  // Any later change clears the undo entry; the next write sweeps the orphan.
  act(() => dispatch({ type: 'applyProject', project: addTrack(currentProject(latest)!, 'Combat') }))
  await settle()
  expect(await imageIds()).toEqual([])
})

test('undoing a delete restores an event whose image is still stored', async () => {
  const live = withImageEvent(project, 'img_undo')
  await seedImage('img_undo')
  await mount([live])
  act(() => dispatch({ type: 'deleteEvent', eventId: live.events[0].id }))
  await settle()
  act(() => dispatch({ type: 'undo' }))
  await settle()
  expect(currentProject(latest)!.events[0].imageId).toBe('img_undo')
  expect(await imageIds()).toEqual(['img_undo'])
})

test('clearing an event image removes the record', async () => {
  const live = withImageEvent(project, 'img_cleared')
  await seedImage('img_cleared')
  await mount([live])
  const cleared = { ...live, events: live.events.map((e) => ({ ...e, imageId: undefined })) }
  act(() => dispatch({ type: 'applyProject', project: cleared }))
  await settle()
  expect(await imageIds()).toEqual([])
})

test("sweeping one project never removes another project's images", async () => {
  const mine = withImageEvent(project, 'img_mine')
  const theirs = withImageEvent(addTrack(other, 'Side'), 'img_theirs', 'Theirs')
  await seedImage('img_mine')
  await seedImage('img_theirs')
  await mount([mine, theirs])
  // Drop my event's image; the other project is not the one being saved.
  act(() => dispatch({ type: 'applyProject', project: { ...mine, events: [] } }))
  act(() => dispatch({ type: 'applyProject', project: addTrack({ ...mine, events: [] }, 'Combat') }))
  await settle()
  expect(await imageIds()).toEqual(['img_theirs'])
})

test('an image that was never referenced in this session is never swept', async () => {
  // Stands for an upload still sitting in an open dialog, an import in flight, or a record
  // another tab owns: none of them is referenced by anything this session has seen.
  await seedImage('img_unseen')
  await mount([project])
  act(() => dispatch({ type: 'applyProject', project: addTrack(project, 'Combat') }))
  await settle()
  expect(db.deleteImage).not.toHaveBeenCalled()
  expect(await imageIds()).toEqual(['img_unseen'])
})

test('removing a project sweeps the images only it referenced', async () => {
  const mine = withImageEvent(project, 'img_removed')
  const theirs = withImageEvent(addTrack(other, 'Side'), 'img_kept', 'Theirs')
  await seedImage('img_removed')
  await seedImage('img_kept')
  await mount([mine, theirs])
  act(() => dispatch({ type: 'removeProject', projectId: mine.id }))
  await settle()
  await act(async () => {
    await Promise.all(vi.mocked(db.deleteProject).mock.results.map((r) => r.value))
    await Promise.resolve()
    await Promise.all(vi.mocked(db.deleteImage).mock.results.map((r) => r.value))
  })
  expect(await imageIds()).toEqual(['img_kept'])
})

test('a session whose storage failed to open deletes nothing', async () => {
  await seedImage('img_precious')
  vi.mocked(db.listProjects).mockRejectedValueOnce(new db.StorageError('No storage.'))
  render(<StoreProvider><Probe /></StoreProvider>)
  await act(async () => {})
  const session = currentProject(latest)!
  const withImage = withImageEvent(addTrack(session, 'Banners'), 'img_precious')
  act(() => dispatch({ type: 'applyProject', project: withImage }))
  act(() => dispatch({ type: 'applyProject', project: { ...withImage, events: [] } }))
  await settle()
  expect(db.deleteImage).not.toHaveBeenCalled()
  expect(await imageIds()).toEqual(['img_precious'])
})

test('an image the stored copy still references survives until a newer write replaces it', async () => {
  const live = withImageEvent(project, 'img_inflight')
  await seedImage('img_inflight')
  await mount([live])
  // Write 1 (still references the image) is in flight when the edit that clears it lands in
  // state. Disk is behind state, so sweeping now could orphan a stored reference on a crash.
  act(() => dispatch({ type: 'applyProject', project: addTrack(live, 'Combat') }))
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS) })
  expect(db.putProject).toHaveBeenCalledTimes(1)
  const cleared = { ...live, events: [] }
  act(() => dispatch({ type: 'applyProject', project: cleared }))
  await act(async () => {
    await vi.mocked(db.putProject).mock.results[0].value
    await Promise.resolve()
  })
  expect(db.deleteImage).not.toHaveBeenCalled()
  expect(await imageIds()).toEqual(['img_inflight'])
  // The newer write then lands and the image is finally unreferenced everywhere.
  await settle()
  expect(await imageIds()).toEqual([])
})
