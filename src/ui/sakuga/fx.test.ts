import { afterEach, expect, test, vi } from 'vitest'
import fxCss from '../../styles/fx.css?raw'
import {
  animating, clack, core, crack, dust, impact, land, palette, pop, quietPress, shatter,
  slashAt, spark, squash, tint, trail, type SakugaCore,
} from './fx'

/**
 * These tests are the guard. The whole suite runs with `window.SakugaFX` absent, so the
 * wrapper's no-op path is exercised 335 times over by every other file — but only by
 * accident, and an accident proves nothing. Here it is asserted directly, and the mutation
 * log in the report records what happens when the guard is removed.
 */

const ALL = [impact, quietPress, dust, slashAt, pop, spark, trail, land, shatter, crack, clack]

type Call = { name: string; args: unknown[] }

/** A stub core that records what was asked of it. `box` is what `at()` reports back. */
function stub(options: { calm?: boolean; box?: Partial<ReturnType<SakugaCore['at']>> } = {}) {
  const calls: Call[] = []
  const record = (name: string) => (...args: unknown[]) => { calls.push({ name, args }) }
  const box = { x: 300, y: 500, w: 160, h: 40, ...options.box }
  const fx = {
    calm: options.calm ?? false,
    // The real at() takes fractions across the box and adds the scroll offset; this
    // reproduces that, so a helper that forgot to ask for an edge is visible in the args.
    at: vi.fn((_el: Element, fracX = 0.5, fracY = 0.5) => ({
      x: box.x + box.w * fracX,
      y: box.y + box.h * fracY,
      w: box.w,
      h: box.h,
    })),
    squashy: vi.fn((el: Element) => {
      calls.push({ name: 'squashy', args: [el] })
      return { step: vi.fn() }
    }),
    puff: record('puff'),
    burst: record('burst'),
    shards: record('shards'),
    ring: record('ring'),
    slash: record('slash'),
    lines: record('lines'),
    ticks: record('ticks'),
    kira: record('kira'),
    sfx: vi.fn((word: string, ...rest: unknown[]) => { calls.push({ name: `sfx:${word}`, args: rest }) }),
    hollow: () => ({ col: '#ffffff', edge: '#1d1a4a' }),
    // Upstream's own light "ink and paper" palette, which is what tint() has to replace.
    P: {
      fill: '#ffffff',
      shade: '#b8b3ff',
      line: '#5a4fd8',
      accent: '#ff5fa8',
      ink: '#1d1a4a',
      sfx: ['#1d1a4a', '#ffffff'] as [string, string],
    },
  }
  vi.stubGlobal('SakugaFX', fx as unknown as SakugaCore)
  return { calls, fx, names: () => calls.map((c) => c.name) }
}

function element(): HTMLElement {
  const el = document.createElement('button')
  document.body.append(el)
  return el
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

// ------------------------------------------------------- the global is absent ------------

test('with no core loaded there is nothing to find and nothing happens', () => {
  expect(globalThis.SakugaFX).toBeUndefined()
  expect(core()).toBeNull()
  expect(animating()).toBe(false)
  const el = element()
  // Every helper, called with a real element. A wrapper that reached for the absent global
  // would throw a TypeError here rather than return.
  for (const effect of ALL) expect(() => effect(el)).not.toThrow()
  expect(() => squash(el)).not.toThrow()
  // And it left no trace on the element: no squash transform, no canvas appended.
  expect(el.getAttribute('style')).toBeNull()
  expect(document.querySelector('canvas')).toBeNull()
})

test('a null or missing element is a no-op even with the core loaded', () => {
  const { calls } = stub()
  for (const effect of ALL) {
    expect(() => effect(null)).not.toThrow()
    expect(() => effect(undefined)).not.toThrow()
  }
  expect(() => squash(null)).not.toThrow()
  expect(calls).toEqual([])
})

// -------------------------------------------------------------- reduced motion -----------

test('reduced motion suppresses every effect, the lettering and the press squash', () => {
  const { calls, fx } = stub({ calm: true })
  const el = element()
  expect(animating()).toBe(false)
  for (const effect of ALL) effect(el)
  squash(el)
  expect(calls).toEqual([])
  // Not even the coordinates are asked for: nothing is going to be drawn with them.
  expect(fx.at).not.toHaveBeenCalled()
  expect(fx.squashy).not.toHaveBeenCalled()
  expect(el.getAttribute('style')).toBeNull()
})

test('the same core with calm cleared animates again, so the gate is the flag and not the stub', () => {
  const { names } = stub({ calm: false })
  impact(element())
  expect(names()).toEqual(['burst', 'sfx:don'])
})

// ------------------------------------------------------------ the right effects ----------

test('a primary press bursts and letters ドン above the control', () => {
  const { calls } = stub({ box: { x: 100, y: 200, w: 80, h: 30 } })
  impact(element())
  expect(calls.map((c) => c.name)).toEqual(['burst', 'sfx:don'])
  // Centre of the box: 100 + 80/2, 200 + 30/2.
  expect(calls[0].args.slice(0, 2)).toEqual([140, 215])
  // The lettering lands clear of the control, above it.
  expect(calls[1].args[1] as number).toBeLessThan(215)
})

test('a quiet press puffs and ticks, and never letters: the loud one has to stay rare', () => {
  const { names } = stub()
  quietPress(element())
  expect(names()).toEqual(['puff', 'ticks'])
  expect(names().some((n) => n.startsWith('sfx'))).toBe(false)
})

test('dust lands at the caret, not in the middle of the field', () => {
  vi.useFakeTimers()
  const { calls } = stub({ box: { x: 0, y: 100, w: 200, h: 24 } })
  const el = element()
  dust(el, 0)
  // Past the throttle window, so the second keystroke is a second puff and not a dropped one.
  vi.advanceTimersByTime(200)
  dust(el, 1)
  const xs = calls.filter((c) => c.name === 'puff').map((c) => c.args[0] as number)
  expect(xs).toHaveLength(2)
  // Inset from both ends, and the end of the field is to the right of the start of it.
  expect(xs[0]).toBeGreaterThan(0)
  expect(xs[1]).toBeGreaterThan(xs[0])
  expect(xs[1]).toBeLessThan(200)
})

test('dust is throttled, so holding a key is one puff and not a storm', () => {
  vi.useFakeTimers()
  const { calls } = stub()
  const el = element()
  for (let i = 0; i < 20; i += 1) dust(el)
  expect(calls).toHaveLength(1)
  // Far enough past the window and the next keystroke puffs again.
  vi.advanceTimersByTime(200)
  dust(el)
  expect(calls).toHaveLength(2)
})

test('the throttle is per element, so two fields do not silence each other', () => {
  vi.useFakeTimers()
  const { calls } = stub()
  dust(element())
  dust(element())
  expect(calls).toHaveLength(2)
})

test('a drag trails speed lines off the edge it is heading away from', () => {
  vi.useFakeTimers()
  const { calls } = stub({ box: { x: 0, y: 0, w: 100, h: 40 } })
  trail(element(), 'right')
  trail(element(), 'left')
  const lines = calls.filter((c) => c.name === 'lines')
  expect(lines).toHaveLength(2)
  // Heading right: the lines hang off the right edge (x = 0 + 100). Left: off x = 0.
  expect(lines[0].args[0]).toBe(100)
  expect(lines[1].args[0]).toBe(0)
  expect(lines[0].args[2]).not.toEqual(lines[1].args[2])
})

test('the rest of the vocabulary is the upstream one, lettering included', () => {
  const cases: [(el: Element) => void, string[]][] = [
    [slashAt, ['slash', 'shards', 'sfx:zuza']],
    [pop, ['ticks', 'sfx:pon']],
    [spark, ['burst', 'kira']],
    [land, ['ring', 'puff']],
    [shatter, ['shards', 'sfx:zuza']],
    // An error is not a celebration.
    [crack, ['shards']],
    [clack, ['sfx:kachi']],
  ]
  for (const [effect, expected] of cases) {
    const { names } = stub()
    effect(element())
    expect(names(), effect.name).toEqual(expected)
    vi.unstubAllGlobals()
  }
})

test('the hollow lettering styles are the core\'s own, not re-invented here', () => {
  const { calls } = stub()
  pop(element())
  const letters = calls.find((c) => c.name === 'sfx:pon')!
  expect(letters.args[2]).toMatchObject({ col: '#ffffff', edge: '#1d1a4a' })
})

// --------------------------------------------------------------------- theming -----------

test('tint writes the theme\'s palette into the live object the core paints from', () => {
  const { fx } = stub()
  tint('dark')
  expect(fx.P).toMatchObject(palette('dark'))
  tint('light')
  expect(fx.P).toMatchObject(palette('light'))
})

test('tint with no core loaded does nothing rather than throwing', () => {
  expect(core()).toBeNull()
  expect(() => tint('dark')).not.toThrow()
})

test('the two palettes differ where it matters: the outline, the accent and the lettering', () => {
  const dark = palette('dark')
  const light = palette('light')
  // A deep violet outline sinks into a near-black page, so dark lifts it.
  expect(dark.line).not.toBe(light.line)
  expect(dark.accent).not.toBe(light.accent)
  // And the lettering inverts: a dark word with a white halo on paper, a white word with a
  // violet edge on black. Upstream's order is [fill, outline].
  expect(dark.sfx[0]).not.toBe(light.sfx[0])
  expect(light.sfx[0]).toBe('#1d1a4a')
  expect(dark.sfx[0]).toBe('#ffffff')
})

test('tint is not gated on calm: the palette must be right before motion is allowed again', () => {
  const { fx } = stub({ calm: true })
  tint('dark')
  expect(fx.P).toMatchObject(palette('dark'))
})

test('fx.css overrides the core\'s ink-and-paper defaults for both themes', () => {
  // The core injects :where(:root){--sk-card:#fff;--sk-ink:#1d1a4a;…} at zero specificity.
  for (const selector of [':root', ":root[data-theme='light']"]) {
    const block = new RegExp(`${selector.replace(/[[\]']/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(fxCss)
    expect(block, selector).not.toBeNull()
    for (const name of ['--sk-card', '--sk-ink', '--sk-acc', '--sk-soft']) {
      expect(block![1], `${selector} ${name}`).toContain(name)
    }
  }
  // Dark is the default here as everywhere else: :root is not the light palette.
  expect(/:root\s*\{[^}]*--sk-card:\s*#0e1016/.test(fxCss)).toBe(true)
  // And the file says, in as many words, that these variables do not colour the effects:
  // believing they do is how a visual change ships that nobody can see.
  expect(fxCss).toMatch(/do NOT colour the effects/)
})

test('the effects canvas never takes a click, whatever else it paints over', () => {
  expect(/canvas\.sakuga-fx\s*\{[^}]*pointer-events:\s*none/.test(fxCss)).toBe(true)
})

// -------------------------------------------------------------------- the press ----------

test('squash asks the core for one spring per control and never a second', () => {
  const { fx } = stub()
  const el = element()
  squash(el)
  squash(el)
  squash(el)
  expect(fx.squashy).toHaveBeenCalledTimes(1)
  expect(fx.squashy).toHaveBeenCalledWith(el)
})
