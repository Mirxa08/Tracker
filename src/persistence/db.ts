import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project } from '../domain/schema'

export type ImageRecord = { id: string; blob: Blob; width: number; height: number }

interface TrackerDB extends DBSchema {
  projects: { key: string; value: Project }
  images: { key: string; value: ImageRecord }
  /** Small named facts about this installation, not about any one project. */
  meta: { key: string; value: boolean }
}

const DB_NAME = 'tracker'
/**
 * 2 added the `meta` store. The upgrade only ever creates a store it cannot find, so an
 * existing database at version 1 gains `meta` and keeps every project and image in it.
 */
const DB_VERSION = 2

export class StorageError extends Error {
  isQuota: boolean
  constructor(message: string, options: { cause?: unknown; isQuota?: boolean } = {}) {
    super(message, { cause: options.cause })
    this.name = 'StorageError'
    this.isQuota = options.isQuota ?? false
  }
}

export function isStorageAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

let dbPromise: Promise<IDBPDatabase<TrackerDB>> | null = null

export function openDb(): Promise<IDBPDatabase<TrackerDB>> {
  if (!isStorageAvailable()) {
    return Promise.reject(
      new StorageError('This browser has no usable storage, so nothing will be saved.'),
    )
  }
  if (!dbPromise) {
    dbPromise = openDB<TrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' })
        // No keyPath: the value is a bare boolean, keyed by the name passed in.
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
      },
      terminated() {
        dbPromise = null
      },
    }).catch((error: unknown) => {
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}

function wrapWriteError(error: unknown): never {
  if (error instanceof StorageError) throw error
  const isQuota =
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  if (isQuota) {
    throw new StorageError(
      'There is no room left in this browser’s storage. Images are the usual cause — remove a few, or export and delete an old project.',
      { cause: error, isQuota: true },
    )
  }
  throw new StorageError('Saving failed and the change was not applied.', { cause: error })
}

export async function listProjects(): Promise<Project[]> {
  const db = await openDb()
  const all = await db.getAll('projects')
  return all.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export async function getProject(id: string): Promise<Project | undefined> {
  return (await openDb()).get('projects', id)
}

export async function putProject(p: Project): Promise<void> {
  try {
    const db = await openDb()
    await db.put('projects', p)
  } catch (error) {
    wrapWriteError(error)
  }
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb()
  await db.delete('projects', id)
}

export async function putImage(record: ImageRecord): Promise<void> {
  try {
    const db = await openDb()
    await db.put('images', record)
  } catch (error) {
    wrapWriteError(error)
  }
}

export async function getImage(id: string): Promise<ImageRecord | undefined> {
  return (await openDb()).get('images', id)
}

export async function deleteImage(id: string): Promise<void> {
  const db = await openDb()
  await db.delete('images', id)
}

/**
 * A named flag about this installation. Used for "the example project has been offered
 * once": it must survive the user deleting everything, or demo content would come back
 * every time the app was opened, which is the most irritating thing a demo can do.
 *
 * Absent reads as false, so a fresh database and a flag never written are the same thing.
 */
export async function getFlag(name: string): Promise<boolean> {
  return (await (await openDb()).get('meta', name)) ?? false
}

export async function setFlag(name: string, value: boolean): Promise<void> {
  try {
    const db = await openDb()
    await db.put('meta', value, name)
  } catch (error) {
    wrapWriteError(error)
  }
}
