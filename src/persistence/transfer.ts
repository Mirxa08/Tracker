import {
  SCHEMA_VERSION, migrate, newId, validateExportFile,
  type ExportFile, type Project,
} from '../domain/schema'
import { getImage, putImage, putProject } from './db'
import { blobToDataUrl, dataUrlToBlob } from './images'

export async function buildExport(
  project: Project,
  opts: { includeImages: boolean },
): Promise<ExportFile> {
  const images: Record<string, string> = {}
  if (opts.includeImages) {
    const ids = [...new Set(project.events.map((e) => e.imageId).filter((id): id is string => !!id))]
    for (const id of ids) {
      const record = await getImage(id)
      if (record) images[id] = await blobToDataUrl(record.blob)
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    project,
    images,
  }
}

export function serializeExport(file: ExportFile): string {
  return JSON.stringify(file, null, 2)
}

export function exportFileName(project: Project, now: Date): string {
  const slug = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project'
  const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
  return `${slug}-${date}.json`
}

/**
 * Import never writes over an existing project: it mints fresh ids for the
 * project, its tracks, its events and its images, so a bad or duplicate file
 * cannot destroy work already in the browser.
 */
export async function importFromJson(json: string): Promise<Project> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    throw new Error('That file could not be read as JSON.', { cause: error })
  }

  const file = migrate(validateExportFile(parsed))

  const imageIdMap = new Map<string, string>()
  for (const [oldId, dataUrl] of Object.entries(file.images)) {
    const blob = await dataUrlToBlob(dataUrl)
    const id = newId('img')
    await putImage({ id, blob, width: 0, height: 0 })
    imageIdMap.set(oldId, id)
  }

  const trackIdMap = new Map<string, string>()
  const tracks = file.project.tracks.map((t) => {
    const id = newId('t')
    trackIdMap.set(t.id, id)
    return { ...t, id }
  })

  const events = file.project.events.map((e) => {
    const mappedImage = e.imageId ? imageIdMap.get(e.imageId) : undefined
    const event = { ...e, id: newId('e'), trackId: trackIdMap.get(e.trackId) ?? e.trackId }
    if (mappedImage) event.imageId = mappedImage
    else delete event.imageId
    return event
  })

  const now = new Date().toISOString()
  const project: Project = {
    ...file.project,
    id: newId('p'),
    tracks,
    events,
    updatedAt: now,
  }
  await putProject(project)
  return project
}
