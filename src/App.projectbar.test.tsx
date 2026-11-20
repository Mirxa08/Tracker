import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addEvent, addTrack, createProject, projectBounds } from './domain/project'
import { SCHEMA_VERSION, type Project } from './domain/schema'
import { xForTime } from './domain/time'
import { deleteProject, listProjects, openDb, putImage, putProject } from './persistence/db'
import { buildExport, serializeExport } from './persistence/transfer'
import { downloadText } from './ui/download'
import { App } from './App'

vi.mock('./ui/download', () => ({ downloadText: vi.fn() }))

const SEED_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x42, 0x17])

beforeEach(async () => {
  vi.mocked(downloadText).mockClear()
  for (const p of await listProjects()) await deleteProject(p.id)
  const images = await (await openDb()).getAllKeys('images')
  for (const k of images) await (await openDb()).delete('images', k)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function seedable(name: string): Project {
  const base = addTrack(createProject(name), 'Banners')
  const now = Date.now()
  return addEvent(base, {
    trackId: base.tracks[0].id,
    name: 'Lily Banner',
    start: new Date(now + 86_400_000).toISOString(),
    end: new Date(now + 10 * 86_400_000).toISOString(),
    notes: { columns: [], rows: [] },
  })
}

async function exportedText(): Promise<string> {
  await waitFor(() => expect(downloadText).toHaveBeenCalled())
  return vi.mocked(downloadText).mock.calls[0][1]
}

test('a cold start can create a track from the project bar and it is saved', async () => {
  const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Banners')
  const { unmount } = render(<App />)
  expect(await screen.findByText(/No tracks yet/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Add track' }))
  expect(prompt).toHaveBeenCalledWith('Track name')
  expect(await screen.findByTestId('track-row')).toBeInTheDocument()
  expect(screen.queryByText(/No tracks yet/)).toBeNull()
  unmount() // flushes the debounced write
  await waitFor(async () => {
    const [saved] = await listProjects()
    expect(saved.tracks.map((t) => t.name)).toEqual(['Banners'])
  })
})

test('cancelling or blanking the track prompt adds nothing', async () => {
  const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce(null).mockReturnValueOnce('   ')
  render(<App />)
  await screen.findByText(/No tracks yet/)
  await userEvent.click(screen.getByRole('button', { name: 'Add track' }))
  await userEvent.click(screen.getByRole('button', { name: 'Add track' }))
  expect(prompt).toHaveBeenCalledTimes(2)
  expect(screen.getByText(/No tracks yet/)).toBeInTheDocument()
})

test('a new project is added, selected, and switching back returns to the first', async () => {
  const { unmount } = render(<App />)
  await screen.findByText(/No tracks yet/)
  const select = screen.getByLabelText(/project/i) as HTMLSelectElement
  const firstId = select.value
  await userEvent.click(screen.getByRole('button', { name: 'New project' }))
  await waitFor(() => expect(select.options).toHaveLength(2))
  expect(select.value).not.toBe(firstId)
  await userEvent.selectOptions(select, firstId)
  expect(select.value).toBe(firstId)
  unmount()
  await waitFor(async () => expect(await listProjects()).toHaveLength(2))
})

test('deleting a project removes its row and keeps the sibling, by id', async () => {
  const keep = createProject('Keep me')
  const doomed = createProject('Doomed')
  await putProject(keep)
  await putProject(doomed)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<App />)
  const select = (await screen.findByLabelText(/project/i)) as HTMLSelectElement
  await waitFor(() => expect(select.options).toHaveLength(2))
  await userEvent.selectOptions(select, doomed.id)
  await userEvent.click(screen.getByRole('button', { name: 'Delete project' }))
  await waitFor(async () => {
    expect((await listProjects()).map((p) => p.id)).toEqual([keep.id])
  })
  expect(select.value).toBe(keep.id)
  expect(within(select).queryByRole('option', { name: 'Doomed' })).toBeNull()
})

test('declining the delete confirmation deletes nothing', async () => {
  const a = createProject('A')
  await putProject(a)
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<App />)
  await screen.findByLabelText(/project/i)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete project' }))
  expect((await listProjects()).map((p) => p.id)).toEqual([a.id])
})

test('deleting the only project leaves a fresh usable one, not a blank app', async () => {
  const only = createProject('Only')
  await putProject(only)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete project' }))
  const select = screen.getByLabelText(/project/i) as HTMLSelectElement
  await waitFor(() => expect(select.value).not.toBe(''))
  expect(select.value).not.toBe(only.id)
  await waitFor(async () => {
    const ids = (await listProjects()).map((p) => p.id)
    expect(ids).not.toContain(only.id)
  })
})

test('a malformed import names the failing field and leaves stored data untouched', async () => {
  const original = seedable('Original')
  await putProject(original)
  const image = await buildExport(original, { includeImages: false })
  // Valid image payload present, then an event whose end precedes its start: the image
  // must not be written for a file that fails validation.
  const bad = {
    ...image,
    images: { img_x: 'data:image/png;base64,AAAA' },
    project: {
      ...image.project,
      events: image.project.events.map((e) => ({ ...e, end: e.start })),
    },
  }
  const before = (await listProjects()).map((p) => p.id)
  const imagesBefore = await (await openDb()).getAllKeys('images')

  render(<App />)
  await screen.findByRole('button', { name: /Lily Banner/ })
  const file = new File([JSON.stringify(bad)], 'bad.json', { type: 'application/json' })
  await userEvent.upload(screen.getByLabelText(/import/i), file)

  expect(await screen.findByRole('alert')).toHaveTextContent('event end must be after its start')
  expect((await listProjects()).map((p) => p.id)).toEqual(before)
  expect(await (await openDb()).getAllKeys('images')).toEqual(imagesBefore)
  expect((screen.getByLabelText(/project/i) as HTMLSelectElement).options).toHaveLength(1)
})

test('a file from a newer schema is rejected with the newer-version message, not imported', async () => {
  const original = seedable('Original')
  await putProject(original)
  const file = await buildExport(original, { includeImages: false })
  const future = { ...file, schemaVersion: SCHEMA_VERSION + 1 }

  render(<App />)
  await screen.findByRole('button', { name: /Lily Banner/ })
  await userEvent.upload(
    screen.getByLabelText(/import/i),
    new File([JSON.stringify(future)], 'future.json', { type: 'application/json' }),
  )

  expect(await screen.findByRole('alert')).toHaveTextContent(/made by a newer version of Tracker/)
  expect((await listProjects()).map((p) => p.id)).toEqual([original.id])
  expect((screen.getByLabelText(/project/i) as HTMLSelectElement).options).toHaveLength(1)
})

test('a file that is not JSON is rejected with a readable reason', async () => {
  render(<App />)
  await screen.findByText(/No tracks yet/)
  await userEvent.upload(
    screen.getByLabelText(/import/i),
    new File(['not json {'], 'x.json', { type: 'application/json' }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not be read as JSON/)
})

test('importing a valid file adds a separate, selected project and never overwrites', async () => {
  const original = seedable('Original')
  await putProject(original)
  const exported = await buildExport(original, { includeImages: false })

  render(<App />)
  await screen.findByRole('button', { name: /Lily Banner/ })
  await userEvent.upload(
    screen.getByLabelText(/import/i),
    new File([serializeExport(exported)], 'ok.json', { type: 'application/json' }),
  )

  const select = screen.getByLabelText(/project/i) as HTMLSelectElement
  await waitFor(() => expect(select.options).toHaveLength(2))
  expect(select.value).not.toBe(original.id)
  const ids = (await listProjects()).map((p) => p.id)
  expect(ids).toHaveLength(2)
  expect(ids).toContain(original.id)
  expect(await screen.findByRole('button', { name: /Lily Banner/ })).toBeInTheDocument()
})

test('the include-images toggle changes the exported payload', async () => {
  const project = seedable('With art')
  const imageId = 'img_seed'
  await putImage({ id: imageId, blob: new Blob([SEED_BYTES], { type: 'image/png' }), width: 0, height: 0 })
  await putProject({ ...project, events: project.events.map((e) => ({ ...e, imageId })) })

  render(<App />)
  await screen.findByRole('button', { name: /Lily Banner/ })

  await userEvent.click(screen.getByRole('button', { name: /^export$/i }))
  const off = JSON.parse(await exportedText())
  expect(off.images).toEqual({})
  expect(vi.mocked(downloadText).mock.calls[0][0]).toMatch(/^with-art-\d{4}-\d{2}-\d{2}\.json$/)

  vi.mocked(downloadText).mockClear()
  await userEvent.click(screen.getByLabelText(/include images/i))
  await userEvent.click(screen.getByRole('button', { name: /^export$/i }))
  const on = JSON.parse(await exportedText())
  expect(Object.keys(on.images)).toEqual([imageId])
  expect(on.images[imageId]).toMatch(/^data:/)
})

test('the Now button scrolls the timeline to the now-line', async () => {
  const scrollTo = vi.fn()
  HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo
  try {
    const project = seedable('Scroll')
    await putProject(project)
    render(<App />)
    await screen.findByRole('button', { name: /Lily Banner/ })
    scrollTo.mockClear() // ignore the on-mount scroll
    await userEvent.click(screen.getByRole('button', { name: 'Now' }))
    // jsdom has no layout, so clientWidth is 0 and the target is the now-line's x itself.
    const now = new Date()
    const expected = xForTime(now, projectBounds(project, now).start)
    expect(expected).toBeGreaterThan(0)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    const arg = scrollTo.mock.calls[0][0] as { left: number; behavior: string }
    expect(arg.behavior).toBe('smooth')
    // The click happens a few ms after `now` was read, so allow a pixel of clock drift.
    expect(Math.abs(arg.left - expected)).toBeLessThan(1)
  } finally {
    // @ts-expect-error restoring jsdom's lack of scrollTo
    delete HTMLElement.prototype.scrollTo
  }
})
