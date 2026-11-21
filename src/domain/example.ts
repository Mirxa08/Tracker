import { addEvent, addTrack, createProject } from './project'
import type { Project } from './schema'

const MS_PER_DAY = 86_400_000

/**
 * A point `days` from `now`, snapped to the given hour of that local day. Local, not UTC:
 * the day grid is built from local calendar days, so an event that reads as "starts
 * Tuesday morning" has to start on Tuesday wherever the reader is.
 */
function at(now: Date, days: number, hour: number): string {
  const day = new Date(now.getTime() + days * MS_PER_DAY)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour).toISOString()
}

/**
 * The project a brand-new visitor opens the app on.
 *
 * Until now first run seeded an EMPTY project, so what the owner actually saw was a
 * toolbar and the sentence "No tracks yet" — nothing to look at, nothing to animate, and
 * the honest report "no animations on anything at all". This seeds something that shows
 * what the app is for: two tracks and five bars, with one event running right now so the
 * now-line crosses it and its countdown badge is on screen, one already finished, and
 * three still ahead.
 *
 * Everything is dated relative to `now` and never hardcoded — a demo that was obviously
 * stale the week after it shipped would be worse than none — and it is built with
 * createProject / addTrack / addEvent, so it is valid by construction: addEvent refuses an
 * unknown track and an end that is not after its start.
 *
 * It is an ORDINARY project. No schema flag, no special-casing, nothing that treats it
 * differently anywhere else in the app: the existing Delete project control removes it,
 * every track and bar can be renamed, dragged or deleted, and it exports like any other.
 * Whether it has been offered once is recorded outside the project, as an installation
 * flag (persistence/db.ts), so deleting it is final.
 */
export function exampleProject(now: Date = new Date()): Project {
  let p = createProject('Example timeline')
  p = addTrack(p, 'Banners')
  p = addTrack(p, 'Events')
  const [banners, events] = p.tracks

  // Running now: the now-line crosses this one and the remaining-time badge counts it down.
  p = addEvent(p, {
    trackId: banners.id,
    name: 'Lily — limited banner',
    start: at(now, -4, 10),
    end: at(now, 10, 10),
  })
  // Still ahead, and lined up to start as the one above ends.
  p = addEvent(p, {
    trackId: banners.id,
    name: 'Changli — limited banner',
    start: at(now, 10, 10),
    end: at(now, 24, 10),
  })
  // Already over: it paints as an ended bar, with no badge.
  p = addEvent(p, {
    trackId: events.id,
    name: 'Illusive Realm',
    start: at(now, -18, 4),
    end: at(now, -4, 4),
  })
  // Running, and shorter: two overlapping bars on different tracks is the thing a
  // day-wise timeline is for, and one row of bars would never have shown it.
  p = addEvent(p, {
    trackId: events.id,
    name: 'Double drop weekend',
    start: at(now, -1, 4),
    end: at(now, 3, 4),
  })
  p = addEvent(p, {
    trackId: events.id,
    name: 'Version 2.4 update',
    start: at(now, 9, 4),
    end: at(now, 16, 4),
  })
  return p
}
