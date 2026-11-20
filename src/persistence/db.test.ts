import { beforeEach } from 'vitest'
import { createProject } from '../domain/project'
import {
  listProjects, getProject, putProject, deleteProject,
  putImage, getImage, deleteImage, isStorageAvailable,
} from './db'

beforeEach(async () => {
  for (const p of await listProjects()) await deleteProject(p.id)
  await deleteImage('img_1')
})

test('reports storage as available under fake-indexeddb', () => {
  expect(isStorageAvailable()).toBe(true)
})

test('stores and reads back a project', async () => {
  const p = createProject('Wuthering Waves')
  await putProject(p)
  expect(await getProject(p.id)).toEqual(p)
})

test('getProject returns undefined for an unknown id', async () => {
  expect(await getProject('p_nope')).toBeUndefined()
})

test('putProject overwrites an existing record rather than duplicating', async () => {
  const p = createProject('First')
  await putProject(p)
  await putProject({ ...p, name: 'Second' })
  const all = await listProjects()
  expect(all).toHaveLength(1)
  expect(all[0].name).toBe('Second')
})

test('listProjects returns the most recently updated first', async () => {
  await putProject({ ...createProject('Older'), updatedAt: '2026-11-01T00:00:00.000Z' })
  await putProject({ ...createProject('Newer'), updatedAt: '2026-11-19T00:00:00.000Z' })
  expect((await listProjects()).map((p) => p.name)).toEqual(['Newer', 'Older'])
})

test('deleteProject removes it', async () => {
  const p = createProject('Temporary')
  await putProject(p)
  await deleteProject(p.id)
  expect(await getProject(p.id)).toBeUndefined()
})

test('stores and reads back an image record', async () => {
  const blob = new Blob(['not really an image'], { type: 'image/webp' })
  await putImage({ id: 'img_1', blob, width: 600, height: 400 })
  const found = await getImage('img_1')
  expect(found?.width).toBe(600)
  expect(found?.blob.size).toBe(blob.size)
  await deleteImage('img_1')
  expect(await getImage('img_1')).toBeUndefined()
})
