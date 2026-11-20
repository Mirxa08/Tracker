import { beforeEach, vi } from 'vitest'
import { createProject } from '../domain/project'
import {
  listProjects, getProject, putProject, deleteProject,
  putImage, getImage, deleteImage, isStorageAvailable, openDb,
} from './db'

beforeEach(async () => {
  const db = await openDb()
  await db.clear('projects')
  await db.clear('images')
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
  // Ids are deliberately in the opposite order to the update times, so the
  // store's key order alone would not produce the sorted result.
  await putProject({ ...createProject('Older'), id: 'p_a', updatedAt: '2026-11-01T00:00:00.000Z' })
  await putProject({ ...createProject('Middle'), id: 'p_c', updatedAt: '2026-11-10T00:00:00.000Z' })
  await putProject({ ...createProject('Newer'), id: 'p_b', updatedAt: '2026-11-19T00:00:00.000Z' })
  expect((await listProjects()).map((p) => p.name)).toEqual(['Newer', 'Middle', 'Older'])
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

test('a failed open does not poison later calls', async () => {
  // A fresh copy of the module has an empty connection cache, so its first open is the one we fail.
  const actual = await vi.importActual<typeof import('idb')>('idb')
  let failNext = true
  vi.doMock('idb', () => ({
    ...actual,
    openDB: (...args: Parameters<typeof actual.openDB>) => {
      if (failNext) {
        failNext = false
        return Promise.reject(new Error('simulated'))
      }
      return actual.openDB(...args)
    },
  }))
  vi.resetModules()
  const fresh = await import('./db')
  await expect(fresh.listProjects()).rejects.toThrow('simulated')
  expect(await fresh.listProjects()).toEqual([])
  vi.doUnmock('idb')
})

test('a terminated connection is reopened on the next call', async () => {
  // fake-indexeddb rejects synthetic close events, so drive the terminated() callback directly
  // and check that the next call opens a new connection rather than reusing the dead one.
  const actual = await vi.importActual<typeof import('idb')>('idb')
  const opened: Array<Parameters<typeof actual.openDB>[2]> = []
  vi.doMock('idb', () => ({
    ...actual,
    openDB: (...args: Parameters<typeof actual.openDB>) => {
      opened.push(args[2])
      return actual.openDB(...args)
    },
  }))
  vi.resetModules()
  const fresh = await import('./db')
  await fresh.listProjects()
  opened[0]?.terminated?.()
  await fresh.listProjects()
  expect(opened).toHaveLength(2)
  vi.doUnmock('idb')
})

test('the no-storage message survives a write attempt', async () => {
  vi.stubGlobal('indexedDB', undefined)
  try {
    await expect(putProject(createProject('Blocked'))).rejects.toThrow('This browser has no usable storage')
  } finally {
    vi.unstubAllGlobals()
  }
})
