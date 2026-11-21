import {
  SCHEMA_VERSION, migrate, newId, validateExportFile,
  type ExportFile, type Project,
} from '../domain/schema'
import { deleteImage, getImage, putImage, putProject } from './db'
import { blobToDataUrl, dataUrlToBlob } from './images'

/**
 * An export, plus the ids of images the project references that the store could not
 * produce. A miss is not an error: the file is complete in every other respect and is
 * worth saving. But it IS silent data loss if nobody says so — the export carries the
 * event's `imageId` with no matching entry in `images`, and importing that file drops
 * the reference, so the picture is gone with no trace of ever having been there. The
 * caller is expected to tell the user. Always empty when images were not requested,
 * since nothing was looked for.
 */
export type ExportResult = { file: ExportFile; missingImageIds: string[] }

export async function buildExport(
  project: Project,
  opts: { includeImages: boolean },
): Promise<ExportResult> {
  const images: Record<string, string> = {}
  const missingImageIds: string[] = []
  if (opts.includeImages) {
    const ids = [...new Set(project.events.map((e) => e.imageId).filter((id): id is string => !!id))]
    for (const id of ids) {
      const record = await getImage(id)
      if (record) images[id] = await blobToDataUrl(record.blob)
      else missingImageIds.push(id)
    }
  }
  return {
    file: {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      project,
      images,
    },
    missingImageIds,
  }
}

/** The sentence shown when an export could not read every image it was asked for. */
export function missingImagesMessage(project: Project, missingImageIds: string[]): string {
  const names = project.events
    .filter((e) => e.imageId && missingImageIds.includes(e.imageId))
    .map((e) => e.name)
  const count = missingImageIds.length
  const subject = count === 1 ? 'image could not be read' : `${count} images could not be read`
  // Names, not ids: "img_7f3a" means nothing to the person who has to go and re-add it.
  const which = names.length > 0 ? ` (${names.join(', ')})` : ''
  return `The file was saved, but ${count === 1 ? 'one ' : ''}${subject}${which} and ${count === 1 ? 'is' : 'are'} not in it.`
}

export function serializeExport(file: ExportFile): string {
  return JSON.stringify(file, null, 2)
}

export function exportFileName(project: Project, now: Date): string {
  const slug = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project'
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
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

  // Images are written before the project, so a failure after this point would
  // orphan them. Track what was written and remove it on the way out.
  const writtenImageIds: string[] = []
  try {
    const imageIdMap = new Map<string, string>()
    for (const [oldId, dataUrl] of Object.entries(file.images)) {
      const blob = await dataUrlToBlob(dataUrl)
      const id = newId('img')
      // Dimensions are not carried in the export file, and nothing reads
      // ImageRecord width/height, so they are stored as 0 on purpose.
      await putImage({ id, blob, width: 0, height: 0 })
      writtenImageIds.push(id)
      imageIdMap.set(oldId, id)
    }

    const trackIdMap = new Map<string, string>()
    const tracks = file.project.tracks.map((t) => {
      const id = newId('t')
      trackIdMap.set(t.id, id)
      return { ...t, id }
    })

    // Guard only: validateProject already rejects events whose trackId is not in the file's tracks.
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
  } catch (error) {
    // Best effort: a failed cleanup must not hide the original error.
    for (const id of writtenImageIds) {
      await deleteImage(id).catch(() => {})
    }
    throw error
  }
}
