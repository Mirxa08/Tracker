export const SCHEMA_VERSION = 1

export type Theme = 'dark' | 'light' | 'system'
export type Notes = { columns: string[]; rows: string[][] }

export type TrackEvent = {
  id: string
  trackId: string
  name: string
  start: string
  end: string
  color: string
  imageId?: string
  notes?: Notes
}

export type Track = {
  id: string
  name: string
  color: string
  order: number
  collapsed: boolean
}

export type Project = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  tracks: Track[]
  events: TrackEvent[]
  settings: { theme: Theme }
}

export type ExportFile = {
  schemaVersion: number
  exportedAt: string
  project: Project
  images: Record<string, string>
}

export class ValidationError extends Error {
  field: string
  constructor(field: string, message: string) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(field, `${field} must be an object`)
  }
  return value as Record<string, unknown>
}

function str(source: Record<string, unknown>, field: string, path = field): string {
  const value = source[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(field, `${path} must be a non-empty string`)
  }
  return value
}

function iso(source: Record<string, unknown>, field: string, path = field): string {
  const value = str(source, field, path)
  if (Number.isNaN(Date.parse(value))) {
    throw new ValidationError(field, `${path} must be an ISO date string`)
  }
  return value
}

function arr(source: Record<string, unknown>, field: string): unknown[] {
  const value = source[field]
  if (!Array.isArray(value)) throw new ValidationError(field, `${field} must be an array`)
  return value
}

function validateNotes(value: unknown): Notes {
  const raw = asRecord(value, 'notes')
  const columns = arr(raw, 'columns').map((c, i) => {
    if (typeof c !== 'string') throw new ValidationError('notes', `notes column ${i} must be a string`)
    return c
  })
  const rows = arr(raw, 'rows').map((row, i) => {
    if (!Array.isArray(row) || row.some((cell) => typeof cell !== 'string')) {
      throw new ValidationError('notes', `notes row ${i} must be an array of strings`)
    }
    if (row.length !== columns.length) {
      throw new ValidationError('notes', `notes row ${i} has ${row.length} cells but there are ${columns.length} columns`)
    }
    return row as string[]
  })
  return { columns, rows }
}

function validateTrack(value: unknown): Track {
  const raw = asRecord(value, 'track')
  const order = raw.order
  if (typeof order !== 'number' || !Number.isFinite(order)) {
    throw new ValidationError('order', 'track order must be a number')
  }
  return {
    id: str(raw, 'id', 'track id'),
    name: str(raw, 'name', 'track name'),
    color: str(raw, 'color', 'track color'),
    order,
    collapsed: raw.collapsed === true,
  }
}

function validateEvent(value: unknown, trackIds: Set<string>): TrackEvent {
  const raw = asRecord(value, 'event')
  const start = iso(raw, 'start', 'event start')
  const end = iso(raw, 'end', 'event end')
  if (Date.parse(end) <= Date.parse(start)) {
    throw new ValidationError('end', 'event end must be after its start')
  }
  const trackId = str(raw, 'trackId', 'event trackId')
  if (!trackIds.has(trackId)) {
    throw new ValidationError('trackId', `event refers to unknown track "${trackId}"`)
  }
  const event: TrackEvent = {
    id: str(raw, 'id', 'event id'),
    trackId,
    name: str(raw, 'name', 'event name'),
    start,
    end,
    color: str(raw, 'color', 'event color'),
  }
  if (typeof raw.imageId === 'string') event.imageId = raw.imageId
  if (raw.notes !== undefined) event.notes = validateNotes(raw.notes)
  return event
}

export function validateProject(value: unknown): Project {
  const raw = asRecord(value, 'project')
  const settings = asRecord(raw.settings ?? {}, 'settings')
  const theme = settings.theme
  if (theme !== 'dark' && theme !== 'light' && theme !== 'system') {
    throw new ValidationError('theme', 'settings.theme must be dark, light or system')
  }
  const tracks = arr(raw, 'tracks').map(validateTrack)
  const trackIds = new Set(tracks.map((t) => t.id))
  return {
    id: str(raw, 'id', 'project id'),
    name: str(raw, 'name'),
    createdAt: iso(raw, 'createdAt'),
    updatedAt: iso(raw, 'updatedAt'),
    tracks,
    events: arr(raw, 'events').map((e) => validateEvent(e, trackIds)),
    settings: { theme },
  }
}

export function validateExportFile(value: unknown): ExportFile {
  const raw = asRecord(value, 'file')
  const version = raw.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ValidationError('schemaVersion', 'schemaVersion must be a positive integer')
  }
  if (version > SCHEMA_VERSION) {
    throw new ValidationError(
      'schemaVersion',
      `This file was made by a newer version of Tracker (schema ${version}); this version understands up to ${SCHEMA_VERSION}.`,
    )
  }
  const images = asRecord(raw.images ?? {}, 'images')
  for (const [key, data] of Object.entries(images)) {
    if (typeof data !== 'string') throw new ValidationError('images', `image "${key}" must be a data URL string`)
  }
  return {
    schemaVersion: version,
    exportedAt: iso(raw, 'exportedAt'),
    project: validateProject(raw.project),
    images: images as Record<string, string>,
  }
}

export function migrate(file: ExportFile): ExportFile {
  // Only schema version 1 exists. Future migrations chain here, each step
  // raising schemaVersion by one, so an old file walks forward to current.
  return file
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}
