import { newId, type Notes, type Project, type Theme, type TrackEvent } from './schema'
import { nextTrackColor } from './palette'

const MS_PER_DAY = 86_400_000
const PAD_DAYS = 30

function touched(p: Project, changes: Partial<Project>): Project {
  return { ...p, ...changes, updatedAt: new Date().toISOString() }
}

function requireAfter(start: string, end: string): void {
  if (Date.parse(end) <= Date.parse(start)) {
    throw new Error('The end must be after the start.')
  }
}

export function createProject(name: string): Project {
  const now = new Date().toISOString()
  return {
    id: newId('p'),
    name,
    createdAt: now,
    updatedAt: now,
    tracks: [],
    events: [],
    // Ruling 25: dark is the default, so a new project asks for dark outright rather than
    // deferring to whatever the platform happens to be set to.
    settings: { theme: 'dark' },
  }
}

export function setTheme(p: Project, theme: Theme): Project {
  return touched(p, { settings: { ...p.settings, theme } })
}

export function addTrack(p: Project, name: string): Project {
  const track = {
    id: newId('t'),
    name,
    color: nextTrackColor(p.tracks.map((t) => t.color)),
    order: p.tracks.length,
    collapsed: false,
  }
  return touched(p, { tracks: [...p.tracks, track] })
}

export function renameTrack(p: Project, trackId: string, name: string): Project {
  return touched(p, {
    tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, name } : t)),
  })
}

export function setTrackCollapsed(p: Project, trackId: string, collapsed: boolean): Project {
  return touched(p, {
    tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, collapsed } : t)),
  })
}

export function deleteTrack(p: Project, trackId: string): Project {
  return touched(p, {
    tracks: p.tracks.filter((t) => t.id !== trackId).map((t, i) => ({ ...t, order: i })),
    events: p.events.filter((e) => e.trackId !== trackId),
  })
}

export function reorderTracks(p: Project, orderedIds: string[]): Project {
  const byId = new Map(p.tracks.map((t) => [t.id, t]))
  const seen = new Set<string>()
  const ordered: Project['tracks'] = []
  for (const id of orderedIds) {
    const track = byId.get(id)
    if (track && !seen.has(id)) {
      seen.add(id)
      ordered.push(track)
    }
  }
  const omitted = p.tracks
    .filter((t) => !seen.has(t.id))
    .sort((a, b) => a.order - b.order)
  const tracks = [...ordered, ...omitted].map((t, i) => ({ ...t, order: i }))
  return touched(p, { tracks })
}

export function addEvent(
  p: Project,
  input: {
    trackId: string
    name: string
    start: string
    end: string
    color?: string
    imageId?: string
    notes?: Notes
  },
): Project {
  const track = p.tracks.find((t) => t.id === input.trackId)
  if (!track) throw new Error(`No such track: ${input.trackId}`)
  requireAfter(input.start, input.end)
  const event: TrackEvent = {
    id: newId('e'),
    trackId: input.trackId,
    name: input.name,
    start: input.start,
    end: input.end,
    color: input.color ?? track.color,
  }
  if (input.imageId) event.imageId = input.imageId
  if (input.notes) event.notes = input.notes
  return touched(p, { events: [...p.events, event] })
}

export function updateEvent(
  p: Project,
  eventId: string,
  patch: Partial<Omit<TrackEvent, 'id'>>,
): Project {
  const existing = p.events.find((e) => e.id === eventId)
  if (!existing) throw new Error(`No such event: ${eventId}`)
  const merged = { ...existing, ...patch }
  requireAfter(merged.start, merged.end)
  if (!p.tracks.some((t) => t.id === merged.trackId)) {
    throw new Error(`No such track: ${merged.trackId}`)
  }
  return touched(p, { events: p.events.map((e) => (e.id === eventId ? merged : e)) })
}

export function deleteEvent(p: Project, eventId: string): Project {
  return touched(p, { events: p.events.filter((e) => e.id !== eventId) })
}

export function eventsForTrack(p: Project, trackId: string): TrackEvent[] {
  return p.events
    .filter((e) => e.trackId === trackId)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

export function projectBounds(p: Project, now: Date): { start: Date; end: Date } {
  const times = p.events.flatMap((e) => [Date.parse(e.start), Date.parse(e.end)])
  const min = times.length ? Math.min(...times, now.getTime()) : now.getTime()
  const max = times.length ? Math.max(...times, now.getTime()) : now.getTime()
  return {
    start: new Date(min - PAD_DAYS * MS_PER_DAY),
    end: new Date(max + PAD_DAYS * MS_PER_DAY),
  }
}
