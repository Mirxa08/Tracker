/**
 * The anime layer, wrapped.
 *
 * public/sakuga-vfx/core.js (vendored from finktheartist/sakuga-vfx, MIT) sets
 * `window.SakugaFX`: springs, one fixed full-page canvas, the key-animation effects and the
 * baked manga lettering. index.html loads it as a classic script. This module is the ONLY
 * thing in src/ that reads that global; everything else calls the intention-named helpers
 * below.
 *
 * Two guards, both in `live()`, and nothing else in this file touches the global:
 *
 *   1. The global may be absent. It always is under vitest, which never loads index.html
 *      and has neither canvas nor requestAnimationFrame worth the name. Every helper then
 *      returns having done nothing, which is what keeps the suite green without a single
 *      mock. There is deliberately no try/catch anywhere here: a swallowed TypeError would
 *      make this guard untestable, because breaking it would look exactly like keeping it.
 *   2. `calm` is the core's live reading of prefers-reduced-motion. The core already drops
 *      its own painted effects when it is set, but not `squashy`, which writes a transform
 *      on the element itself — so the gate lives here, once, for both.
 *
 * Coordinates: `at(el)` returns PAGE coordinates (viewport rect plus scroll), which is what
 * the canvas paints in, so an effect scrolls with the control that fired it.
 */

/** What `at()` reports: a point in page coordinates, plus the element's box. */
export type FxBox = { x: number; y: number; w: number; h: number }

/** Lettering style, as the core's `hollow()` and `dotted()` return it. */
export type FxLettering = { col?: string; edge?: string; dots?: boolean }

/** A squash handle: the core drives the spring, we step it. */
export type FxSquash = { step: (dt: number) => void }

type Effect = (x: number, y: number, opts?: Record<string, unknown>) => unknown

/**
 * The slice of `window.SakugaFX` this app uses. The pinned core provides exactly these
 * effects and exactly these five lettering words — the commit the file is vendored from
 * deliberately removed the glow, screentone, smoke, lightning and shockwave effects and the
 * BANG and ズバッ lettering, so there is nothing else to reach for.
 */
export type SakugaCore = {
  readonly calm: boolean
  at: (el: Element, fx?: number, fy?: number) => FxBox
  squashy: (el: Element, opts?: Record<string, unknown>) => FxSquash
  puff: Effect
  burst: Effect
  shards: Effect
  ring: Effect
  slash: Effect
  lines: Effect
  ticks: Effect
  kira: Effect
  sfx: (
    word: 'don' | 'gogo' | 'kachi' | 'pon' | 'shu' | 'zuza',
    x: number,
    y: number,
    opts?: Record<string, unknown>,
  ) => unknown
  hollow: () => FxLettering
}

declare global {
  // eslint-disable-next-line no-var
  var SakugaFX: SakugaCore | undefined
}

/** The core, or null when it never loaded. Exported for the tests that prove the guard. */
export function core(): SakugaCore | null {
  return globalThis.SakugaFX ?? null
}

/**
 * The core, or null when there is nothing to animate with — the global is absent, or the
 * reader has asked for reduced motion. Every helper below starts here, and each then checks
 * the result: `live()` returning null is the whole of both guards.
 */
function live(): SakugaCore | null {
  const fx = core()
  return fx && !fx.calm ? fx : null
}

/** True when an effect would actually paint. For callers that want to skip the work. */
export function animating(): boolean {
  return live() !== null
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

// ---------------------------------------------------------------- throttling -------------
// A repeat-key or a pointermove storm must not become an effect storm: one puff per
// keystroke is the point, a hundred a second is not.

const DUST_MS = 90
const TRAIL_MS = 90

const lastFired = new WeakMap<Element, Map<string, number>>()

function throttle(el: Element, name: string, ms: number): boolean {
  let marks = lastFired.get(el)
  if (!marks) lastFired.set(el, (marks = new Map()))
  const now = Date.now()
  const previous = marks.get(name)
  if (previous !== undefined && now - previous < ms) return false
  marks.set(name, now)
  return true
}

// ------------------------------------------------------------------- the press -----------
// `squashy` attaches its own pointer listeners and hands back a spring that has to be
// stepped every frame. The core's own clock only steps its components, so this drives the
// handles itself — and only in bursts: a press settles in well under a second, and an
// always-on requestAnimationFrame on an idle page is not acceptable for decoration.

const SETTLE_MS = 1200

type Driven = { el: HTMLElement; handle: FxSquash }

const squashed = new WeakMap<HTMLElement, FxSquash>()
const driving = new Set<Driven>()
let frame = 0
let lastFrameMs = 0
let awakeUntil = 0

const clockNow = () => (typeof performance === 'undefined' ? Date.now() : performance.now())

function pump(ms: number) {
  const dt = Math.min(0.034, Math.max(0, (ms - lastFrameMs) / 1000))
  lastFrameMs = ms
  for (const entry of [...driving]) {
    // An unmounted control's handle would otherwise keep this set — and the element —
    // alive for the life of the page.
    if (!entry.el.isConnected) {
      driving.delete(entry)
      squashed.delete(entry.el)
      continue
    }
    entry.handle.step(dt)
  }
  if (ms < awakeUntil && driving.size > 0) {
    frame = requestAnimationFrame(pump)
    return
  }
  frame = 0
  // A long final step converges the spring, so a control never keeps a residual transform
  // from the frame the loop happened to stop on.
  for (const entry of driving) if (entry.el.isConnected) entry.handle.step(1)
}

function wake() {
  if (!live() || driving.size === 0 || typeof requestAnimationFrame !== 'function') return
  awakeUntil = clockNow() + SETTLE_MS
  if (frame) return
  lastFrameMs = clockNow()
  frame = requestAnimationFrame(pump)
}

const WAKE_ON = ['pointerdown', 'pointerup', 'pointercancel', 'pointerleave', 'blur'] as const

/**
 * Give a control the press squash: flat while held, overshooting back on release. Safe to
 * call on every render — the second call for an element does nothing.
 */
export function squash(el: HTMLElement | null | undefined): void {
  const fx = live()
  if (!fx || !el || squashed.has(el)) return
  const handle = fx.squashy(el)
  squashed.set(el, handle)
  driving.add({ el, handle })
  for (const type of WAKE_ON) el.addEventListener(type, wake)
}

// -------------------------------------------------------------- the reactions ------------
// The upstream vocabulary, named for what the control is doing rather than for the shape
// that gets drawn. Lettering is rationed on purpose: a page where every control shouts has
// no impact frame at all.

/** A primary action landing: the impact burst and ドン!. The loud one. */
export function impact(el: Element | null | undefined): void {
  const fx = live()
  if (!fx || !el) return
  const { x, y, h } = fx.at(el)
  fx.burst(x, y, { r: 52, spikes: 14 })
  fx.sfx('don', x, y - h - 10, { size: 96 })
}

/** A secondary action — Cancel, Close: smoke and a tick fan, and deliberately no lettering. */
export function quietPress(el: Element | null | undefined): void {
  const fx = live()
  if (!fx || !el) return
  const { x, y } = fx.at(el)
  fx.puff(x, y, { n: 4, size: 10, life: 0.6 })
  fx.ticks(x, y, { n: 3, r: 18 })
}

/**
 * Dust kicked up at the caret, as upstream's input does. `caret` is 0 (start of the field)
 * to 1 (end), so the puff follows the text rather than sitting in the middle of the box.
 * Throttled: one puff per keystroke, not one per repeat-key frame.
 */
export function dust(el: Element | null | undefined, caret = 0.5): void {
  const fx = live()
  if (!fx || !el) return
  if (!throttle(el, 'dust', DUST_MS)) return
  const { x, y, w, h } = fx.at(el, 0, 0.5)
  const inset = Math.min(8, w / 4)
  fx.puff(x + inset + clamp01(caret) * Math.max(0, w - inset * 2), y + h / 5, {
    n: 3,
    size: 7,
    vy: -14,
    spread: 0.7,
    life: 0.55,
  })
}

/** A checkbox taking: the slash, the crystals it throws off, and ズザッ. */
export function slashAt(el: Element | null | undefined): void {
  const fx = live()
  if (!fx || !el) return
  const { x, y, w } = fx.at(el)
  fx.slash(x, y, { len: Math.max(90, w * 1.6) })
  fx.shards(x, y, { n: 8, size: 4, speed: 150 })
  fx.sfx('zuza', x + 40, y - 26, { size: 58 })
}

/** A choice popping in: the tick fan and a hollow ポン. */
export function pop(el: Element | null | undefined): void {
  const fx = live()
  if (!fx || !el) return
  const { x, y, h } = fx.at(el)
  fx.ticks(x, y, { n: 5, r: 20, fan: 0.9 })
  fx.sfx('pon', x, y - h - 6, { size: 52, ...fx.hollow() })
}

/** A bar arriving: the burst and a sparkle over it. */
export function spark(el: Element | null | undefined): void {
  const fx = live()
  if (!fx || !el) return
  const { x, y, w, h } = fx.at(el)
  fx.burst(x, y, { r: 40 })
  fx.kira(x + Math.min(w, 120) / 2, y - h / 2 - 6, { r: 11 })
}

/** Speed lines off the trailing edge of a bar being dragged. Throttled to the frame rate. */
export function trail(el: Element | null | undefined, towards: 'left' | 'right' = 'right'): void {
  const fx = live()
  if (!fx || !el) return
  if (!throttle(el, 'trail', TRAIL_MS)) return
  const { x, y } = fx.at(el, towards === 'right' ? 1 : 0, 0.5)
  fx.lines(x, y, { n: 6, dir: towards === 'right' ? Math.PI : 0, len: 50, spread: 22 })
}

/** A bar set down: the impact ring and a little smoke under it. */
export function land(el: Element | null | undefined): void {
  const fx = live()
  if (!fx || !el) return
  const { x, y, h } = fx.at(el)
  fx.ring(x, y + h / 2, { rx: 46, ry: 13 })
  fx.puff(x, y + h / 2, { n: 4, size: 11 })
}

/** Something destroyed: crystals and ズザッ. */
export function shatter(el: Element | null | undefined): void {
  const fx = live()
  if (!fx || !el) return
  const { x, y } = fx.at(el)
  fx.shards(x, y, { n: 10, size: 6, arc: Math.PI * 2, speed: 210 })
  fx.sfx('zuza', x, y - 30, { size: 62 })
}

/** Something went wrong: crystals, and no lettering. An error is not a celebration. */
export function crack(el: Element | null | undefined): void {
  const fx = live()
  if (!fx || !el) return
  const { x, y } = fx.at(el, 0.1, 0.5)
  fx.shards(x, y, { n: 7, size: 5, speed: 160 })
}

/** Undo: a hollow カチ, and nothing else. It is a small, quiet correction. */
export function clack(el: Element | null | undefined): void {
  const fx = live()
  if (!fx || !el) return
  const { x, y, h } = fx.at(el)
  fx.sfx('kachi', x, y - h, { size: 54, ...fx.hollow() })
}
