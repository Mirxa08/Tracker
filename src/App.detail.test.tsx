import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addEvent, addTrack, createProject } from './domain/project'
import type { Project, TrackEvent } from './domain/schema'
import { DAY_WIDTH } from './domain/time'
import { deleteProject, listProjects, putProject } from './persistence/db'
import { App } from './App'

async function seed(): Promise<{ project: Project; event: TrackEvent }> {
  const today = new Date()
  const base = addTrack(createProject('Seeded'), 'Banners')
  const project = addEvent(base, {
    trackId: base.tracks[0].id,
    name: 'Lily Banner',
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString(),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 20).toISOString(),
    notes: { columns: ['Resource', 'Left'], rows: [['Astrite', '12000']] },
  })
  await putProject(project)
  return { project, event: project.events[0] }
}

beforeEach(async () => {
  for (const p of await listProjects()) await deleteProject(p.id)
})

afterEach(() => {
  cleanup()
})

test('clicking a bar opens the detail panel; close dismisses it', async () => {
  await seed()
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Lily Banner/ }))
  const panel = screen.getByRole('complementary', { name: 'Event details' })
  expect(panel).toHaveTextContent('Astrite')
  await userEvent.click(screen.getByRole('button', { name: 'Close details' }))
  expect(screen.queryByRole('complementary', { name: 'Event details' })).toBeNull()
})

test('dragging a bar does not open the panel', async () => {
  await seed()
  render(<App />)
  const bar = await screen.findByRole('button', { name: /Lily Banner/ })
  fireEvent.pointerDown(bar, { clientX: 100, pointerId: 1, button: 0 })
  fireEvent.pointerMove(bar, { clientX: 100 + 2 * DAY_WIDTH, pointerId: 1 })
  fireEvent.pointerUp(bar, { clientX: 100 + 2 * DAY_WIDTH, pointerId: 1 })
  fireEvent.click(bar)
  expect(screen.queryByRole('complementary', { name: 'Event details' })).toBeNull()
})

test('dragging a bar saves the new dates', async () => {
  const { event } = await seed()
  const { unmount } = render(<App />)
  const bar = await screen.findByRole('button', { name: /Lily Banner/ })
  fireEvent.pointerDown(bar, { clientX: 100, pointerId: 1, button: 0 })
  fireEvent.pointerMove(bar, { clientX: 100 + 2 * DAY_WIDTH, pointerId: 1 })
  fireEvent.pointerUp(bar, { clientX: 100 + 2 * DAY_WIDTH, pointerId: 1 })
  unmount() // flushes the debounced write
  await waitFor(async () => {
    const [saved] = await listProjects()
    const moved = saved.events[0]
    const day = (iso: string) => new Date(iso).getDate()
    const expected = new Date(event.start)
    expected.setDate(expected.getDate() + 2)
    expect(moved.id).toBe(event.id)
    expect(day(moved.start)).toBe(expected.getDate())
    expect(Date.parse(moved.end) - Date.parse(moved.start)).toBeGreaterThan(18 * 86_400_000)
  })
})

test('deleting an event and pressing Undo restores that same event', async () => {
  const { event } = await seed()
  const { unmount } = render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Lily Banner/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(screen.queryByRole('button', { name: /Lily Banner/ })).toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent('Deleted "Lily Banner"')

  await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
  expect(await screen.findByRole('button', { name: /Lily Banner/ })).toBeInTheDocument()
  expect(screen.queryByRole('status')).toBeNull()

  await act(async () => { unmount() }) // flush the write, then read what reached storage
  await waitFor(async () => {
    const [saved] = await listProjects()
    expect(saved.events).toHaveLength(1)
    expect(saved.events[0]).toEqual(event)
  })
})
