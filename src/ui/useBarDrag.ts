import { useRef, useState } from 'react'
import type { TrackEvent } from '../domain/schema'
import { DAY_WIDTH } from '../domain/time'

export type DragMode = 'move' | 'resize-start' | 'resize-end'

type Dates = { start: string; end: string }

const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000
/** Pointer travel (px) below which a press is still a click, not a drag. */
const CLICK_SLOP = 4

export function snapToDay(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const halfway = start.getTime() + MS_PER_DAY / 2
  return date.getTime() >= halfway
    ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    : start
}

// Calendar-day shift: the wall-clock time of day is kept, so an event that runs midnight to
// midnight still does after a drag across a daylight-saving change.
function shiftDays(iso: string, days: number): Date {
  const d = new Date(iso)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes())
}

export function applyDrag(event: TrackEvent, mode: DragMode, deltaDays: number): Dates {
  if (mode === 'move') {
    return {
      start: shiftDays(event.start, deltaDays).toISOString(),
      end: shiftDays(event.end, deltaDays).toISOString(),
    }
  }
  if (mode === 'resize-end') {
    const end = shiftDays(event.end, deltaDays)
    const floor = new Date(Date.parse(event.start) + MS_PER_DAY)
    return { start: event.start, end: (end.getTime() > floor.getTime() ? end : floor).toISOString() }
  }
  const start = shiftDays(event.start, deltaDays)
  const ceiling = new Date(Date.parse(event.end) - MS_PER_DAY)
  return { start: (start.getTime() < ceiling.getTime() ? start : ceiling).toISOString(), end: event.end }
}

/** Fine-grained variant (modifier held): shifts by elapsed hours; a resize keeps at least one hour. */
export function applyDragHours(event: TrackEvent, mode: DragMode, deltaHours: number): Dates {
  const shift = (iso: string) => new Date(Date.parse(iso) + deltaHours * MS_PER_HOUR)
  if (mode === 'move') {
    return { start: shift(event.start).toISOString(), end: shift(event.end).toISOString() }
  }
  if (mode === 'resize-end') {
    const end = shift(event.end)
    const floor = new Date(Date.parse(event.start) + MS_PER_HOUR)
    return { start: event.start, end: (end.getTime() > floor.getTime() ? end : floor).toISOString() }
  }
  const start = shift(event.start)
  const ceiling = new Date(Date.parse(event.end) - MS_PER_HOUR)
  return { start: (start.getTime() < ceiling.getTime() ? start : ceiling).toISOString(), end: event.end }
}

/** The dates a drag of `dx` pixels produces, or null when it snaps to no change. */
export function dragDates(event: TrackEvent, mode: DragMode, dx: number, fine: boolean): Dates | null {
  if (fine) {
    const hours = Math.round(dx / (DAY_WIDTH / 24))
    return hours === 0 ? null : applyDragHours(event, mode, hours)
  }
  const days = Math.round(dx / DAY_WIDTH)
  return days === 0 ? null : applyDrag(event, mode, days)
}

export function useBarDrag({
  event,
  onCommit,
}: {
  event: TrackEvent
  onCommit: (dates: Dates) => void
}) {
  const [preview, setPreview] = useState<Dates | null>(null)
  const latest = useRef({ event, onCommit })
  latest.current = { event, onCommit }

  const onPointerDown = (mode: DragMode) => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const originX = e.clientX
    const startEvent = latest.current.event
    const target = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    if (typeof target.setPointerCapture === 'function') target.setPointerCapture(pointerId)
    let travelled = 0

    const finish = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', cancel)
      if (typeof target.releasePointerCapture === 'function' && target.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture(pointerId)
      }
    }

    const move = (ev: PointerEvent) => {
      travelled = Math.max(travelled, Math.abs(ev.clientX - originX))
      setPreview(dragDates(startEvent, mode, ev.clientX - originX, ev.shiftKey))
    }

    const up = (ev: PointerEvent) => {
      finish()
      const dx = ev.clientX - originX
      travelled = Math.max(travelled, Math.abs(dx))
      const dates = dragDates(startEvent, mode, dx, ev.shiftKey)
      if (dates) latest.current.onCommit(dates)
      setPreview(null)
      if (travelled >= CLICK_SLOP) swallowNextClick()
    }

    const cancel = () => {
      finish()
      setPreview(null)
    }

    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', cancel)
  }

  return { onPointerDown, preview }
}

/**
 * Releasing a drag over a bar fires a click on it, which would open the detail panel. Eat the
 * one click that follows; if none arrives (released elsewhere) the guard removes itself.
 */
function swallowNextClick() {
  const stop = (ev: Event) => {
    ev.stopPropagation()
    ev.preventDefault()
    window.removeEventListener('click', stop, true)
  }
  window.addEventListener('click', stop, true)
  setTimeout(() => window.removeEventListener('click', stop, true), 0)
}
