import { beforeEach } from 'vitest'
import { addEvent, addTrack, createProject } from '../domain/project'
import { SCHEMA_VERSION } from '../domain/schema'
import { deleteProject, getImage, listProjects, putImage, putProject } from './db'
import { buildExport, serializeExport, exportFileName, importFromJson } from './transfer'

beforeEach(async () => {
  for (const p of await listProjects()) await deleteProject(p.id)
})

async function seeded() {
  let p = addTrack(createProject('Wuthering Waves'), 'Banners')
  await putImage({
    id: 'img_seed',
    blob: new Blob([new Uint8Array([7, 7, 7])], { type: 'image/webp' }),
    width: 10,
    height: 10,
  })
  p = addEvent(p, {
    trackId: p.tracks[0].id,
    name: 'Lily Banner',
    start: '2026-11-05T00:00:00.000Z',
    end: '2026-11-26T00:00:00.000Z',
    imageId: 'img_seed',
    notes: { columns: ['Resource', 'Left'], rows: [['Astrite', '12000']] },
  })
  await putProject(p)
  return p
}

test('buildExport embeds images when asked', async () => {
  const p = await seeded()
  const file = await buildExport(p, { includeImages: true })
  expect(file.schemaVersion).toBe(SCHEMA_VERSION)
  expect(Object.keys(file.images)).toEqual(['img_seed'])
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
  expect(exportFileName(p, new Date('2026-11-20T00:00:00.000Z')))
    .toBe('wuthering-waves-banners-2026-11-20.json')
})

test('export then import round-trips the project content', async () => {
  const p = await seeded()
  const json = serializeExport(await buildExport(p, { includeImages: true }))
  const imported = await importFromJson(json)
  expect(imported.name).toBe(p.name)
  expect(imported.tracks.map((t) => t.name)).toEqual(['Banners'])
  expect(imported.events[0].name).toBe('Lily Banner')
  expect(imported.events[0].notes).toEqual(p.events[0].notes)
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
  expect(await getImage(newImageId!)).toBeDefined()
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
