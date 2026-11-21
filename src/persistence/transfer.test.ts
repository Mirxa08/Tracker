import { beforeEach, vi } from 'vitest'
import { addEvent, addTrack, createProject } from '../domain/project'
import { SCHEMA_VERSION } from '../domain/schema'
import { deleteProject, getImage, listProjects, openDb, putImage, putProject } from './db'
import { blobToDataUrl } from './images'
import { buildExport, serializeExport, exportFileName, importFromJson } from './transfer'

// putProject is passed through by default; the cleanup test makes one call reject.
vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./db')>()
  return { ...actual, putProject: vi.fn(actual.putProject) }
})

const SEED_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x42, 0x17])
// Different length and content, so bytes attached to the wrong event are observable.
const SECOND_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06])

beforeEach(async () => {
  for (const p of await listProjects()) await deleteProject(p.id)
})

function without<T extends object>(obj: T, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)))
}

async function imageKeys(): Promise<string[]> {
  const keys = await (await openDb()).getAllKeys('images')
  return keys.map(String).sort()
}

async function seeded() {
  let p = addTrack(createProject('Wuthering Waves'), 'Banners')
  p = addTrack(p, 'Events')
  // A fixed creation time, so a round-trip that re-stamps it cannot pass by coincidence.
  p = { ...p, settings: { theme: 'dark' }, createdAt: '2026-07-01T10:00:00.000Z' }
  await putImage({
    id: 'img_seed',
    blob: new Blob([SEED_BYTES], { type: 'image/webp' }),
    width: 10,
    height: 10,
  })
  p = addEvent(p, {
    trackId: p.tracks[0].id,
    name: 'Lily Banner',
    start: '2026-11-05T08:30:00.000Z',
    end: '2026-11-26T17:45:00.000Z',
    color: '#e4701e',
    imageId: 'img_seed',
    notes: { columns: ['Resource', 'Left'], rows: [['Astrite', '12000'], ['Lunite', '3']] },
  })
  await putImage({
    id: 'img_second',
    blob: new Blob([SECOND_BYTES], { type: 'image/png' }),
    width: 10,
    height: 10,
  })
  p = addEvent(p, {
    trackId: p.tracks[1].id,
    name: 'Patch Window',
    start: '2026-11-12T06:15:00.000Z',
    end: '2026-11-14T22:00:00.000Z',
    color: '#16a085',
    imageId: 'img_second',
  })
  await putProject(p)
  return p
}

test('buildExport embeds images when asked', async () => {
  const p = await seeded()
  const file = await buildExport(p, { includeImages: true })
  expect(file.schemaVersion).toBe(SCHEMA_VERSION)
  expect(Object.keys(file.images).sort()).toEqual(['img_second', 'img_seed'])
  expect(file.images.img_seed.startsWith('data:image/webp;base64,')).toBe(true)
})

test('buildExport omits images when not asked', async () => {
  const p = await seeded()
  const file = await buildExport(p, { includeImages: false })
  expect(file.images).toEqual({})
  expect(file.project.events[0].imageId).toBe('img_seed')
})

test('serializeExport produces indented JSON', () => {
  const json = serializeExport({
    schemaVersion: SCHEMA_VERSION,
    exportedAt: '2026-11-20T00:00:00.000Z',
    project: createProject('P'),
    images: {},
  })
  expect(json).toContain('\n  ')
})

test('exportFileName is filesystem-safe and dated', () => {
  const p = createProject('Wuthering Waves: Banners!')
  expect(exportFileName(p, new Date(2026, 10, 20, 0, 0)))
    .toBe('wuthering-waves-banners-2026-11-20.json')
})

test('exportFileName uses the local calendar day, not the UTC one', () => {
  // The suite runs in Europe/London (vite.config.ts). Half past midnight local time on a BST
  // date is 23:30 UTC the day before, so a UTC-based name would say the 19th. A November (GMT)
  // fixture could never tell the two apart.
  const p = createProject('Day')
  const justAfterMidnightBst = new Date(2026, 6, 20, 0, 30)
  expect(justAfterMidnightBst.getUTCDate()).toBe(19) // guards the fixture itself
  expect(exportFileName(p, justAfterMidnightBst)).toBe('day-2026-07-20.json')
})

test('export then import round-trips the project content', async () => {
  const p = await seeded()
  const json = serializeExport(await buildExport(p, { includeImages: true }))
  const imported = await importFromJson(json)

  expect(imported.name).toBe(p.name)
  expect(imported.createdAt).toBe('2026-07-01T10:00:00.000Z')
  expect(imported.createdAt).toBe(p.createdAt)
  expect(imported.settings).toEqual(p.settings)
  expect(imported.settings.theme).toBe('dark')

  // Tracks: every field except the id, which is re-minted on import.
  expect(imported.tracks.map((t) => t.name)).toEqual(['Banners', 'Events'])
  expect(imported.tracks.map((t) => without(t, ['id'])))
    .toEqual(p.tracks.map((t) => without(t, ['id'])))

  // Events: every field except id and trackId (relinking is checked below).
  // imageId is compared by presence only, because import mints a new image id.
  expect(imported.events.map((e) => without(e, ['id', 'trackId', 'imageId'])))
    .toEqual(p.events.map((e) => without(e, ['id', 'trackId', 'imageId'])))
  expect(imported.events.map((e) => e.imageId !== undefined))
    .toEqual(p.events.map((e) => e.imageId !== undefined))
  expect(imported.events[0].notes).toEqual(p.events[0].notes)
  expect(imported.events[0].start).toBe('2026-11-05T08:30:00.000Z')
  expect(imported.events[0].end).toBe('2026-11-26T17:45:00.000Z')
  expect(imported.events[0].color).toBe('#e4701e')
})

test('import relinks every event to a track of the imported project', async () => {
  const p = await seeded()
  const imported = await importFromJson(serializeExport(await buildExport(p, { includeImages: true })))
  const importedTrackIds = imported.tracks.map((t) => t.id)

  for (const e of imported.events) expect(importedTrackIds).toContain(e.trackId)
  expect(imported.events[0].trackId).toBe(imported.tracks[0].id)
  expect(imported.events[1].trackId).toBe(imported.tracks[1].id)
  // Fresh track ids: none of the originals survive.
  expect(importedTrackIds.some((id) => p.tracks.some((t) => t.id === id))).toBe(false)
})

test('import creates a new project rather than overwriting the original', async () => {
  const p = await seeded()
  const json = serializeExport(await buildExport(p, { includeImages: true }))
  const imported = await importFromJson(json)
  expect(imported.id).not.toBe(p.id)
  expect((await listProjects()).map((x) => x.id).sort()).toEqual([imported.id, p.id].sort())
})

test('import stores embedded images under fresh ids and relinks the events', async () => {
  const p = await seeded()
  const json = serializeExport(await buildExport(p, { includeImages: true }))
  const imported = await importFromJson(json)
  const newImageId = imported.events[0].imageId
  expect(newImageId).toBeDefined()
  expect(newImageId).not.toBe('img_seed')
  const stored = await getImage(newImageId!)
  expect(stored).toBeDefined()
  expect(stored!.blob.type).toBe('image/webp')
  expect(stored!.blob.size).toBe(SEED_BYTES.length)
  // Byte-for-byte: a data URL encodes both the bytes and the MIME type.
  expect(await blobToDataUrl(stored!.blob))
    .toBe(await blobToDataUrl(new Blob([SEED_BYTES], { type: 'image/webp' })))
})

test('each imported event gets the bytes of its own image', async () => {
  const p = await seeded()
  const imported = await importFromJson(serializeExport(await buildExport(p, { includeImages: true })))
  const [first, second] = imported.events
  expect(first.imageId).toBeDefined()
  expect(second.imageId).toBeDefined()
  expect(first.imageId).not.toBe(second.imageId)
  const firstStored = await getImage(first.imageId!)
  const secondStored = await getImage(second.imageId!)
  expect(await blobToDataUrl(firstStored!.blob))
    .toBe(await blobToDataUrl(new Blob([SEED_BYTES], { type: 'image/webp' })))
  expect(await blobToDataUrl(secondStored!.blob))
    .toBe(await blobToDataUrl(new Blob([SECOND_BYTES], { type: 'image/png' })))
})

test('import of a structure-only file leaves events without images', async () => {
  const p = await seeded()
  const json = serializeExport(await buildExport(p, { includeImages: false }))
  const imported = await importFromJson(json)
  expect(imported.events[0].imageId).toBeUndefined()
})

test('import rejects malformed JSON with a readable message', async () => {
  await expect(importFromJson('{not json')).rejects.toThrow(/could not be read/i)
})

test('import rejects a file from a newer schema version', async () => {
  const p = await seeded()
  const file = await buildExport(p, { includeImages: false })
  const json = JSON.stringify({ ...file, schemaVersion: SCHEMA_VERSION + 1 })
  await expect(importFromJson(json)).rejects.toThrow(/newer version/i)
})

test('a rejected import leaves existing projects untouched', async () => {
  const p = await seeded()
  await expect(importFromJson('{not json')).rejects.toThrow()
  expect((await listProjects()).map((x) => x.id)).toEqual([p.id])
})

test('a failed project write leaves no image records behind', async () => {
  const p = await seeded()
  const json = serializeExport(await buildExport(p, { includeImages: true }))
  const before = await imageKeys()
  vi.mocked(putProject).mockRejectedValueOnce(new Error('disk full'))
  await expect(importFromJson(json)).rejects.toThrow('disk full')
  expect(await imageKeys()).toEqual(before)
})
