import css from './theme.css?raw'

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|[}/])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  if (!match) throw new Error(`no rule for ${selector}`)
  return match[1]
}

/** Custom properties declared in a block, as name -> value. */
function vars(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().toLowerCase()]),
  )
}

/** Relative luminance (WCAG) of a #rrggbb colour, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}

const DARK = {
  '--bg': '#0f1115',
  '--surface': '#171a20',
  '--fg': '#e9ebf0',
  '--muted': '#9aa1ae',
  '--line': '#23262d',
  '--now': '#ff6b7a',
}

// Ruling 25: dark is the default. If the default is ever flipped these must fail, so the
// change is made deliberately rather than by accident.
test(':root declares the dark palette, so dark is the no-signal default', () => {
  const root = vars(rule(':root'))
  for (const [name, value] of Object.entries(DARK)) expect(root[name]).toBe(value)
  expect(luminance(root['--bg'])).toBeLessThan(0.1)
  expect(luminance(root['--fg'])).toBeGreaterThan(0.5)
})

test('light values only apply under a light preference or an explicit light theme', () => {
  expect(css).toMatch(/@media \(prefers-color-scheme: light\)\s*\{\s*:root:not\(\[data-theme='dark'\]\)/)
  expect(vars(rule(`:root[data-theme='dark']`))).toEqual(DARK)
})

test('the light override is the inverse of dark: lighter background, darker text', () => {
  const dark = vars(rule(':root'))
  const light = vars(rule(`:root[data-theme='light']`))
  expect(Object.keys(light).sort()).toEqual(Object.keys(DARK).sort())
  expect(luminance(light['--bg'])).toBeGreaterThan(luminance(dark['--bg']))
  expect(luminance(light['--surface'])).toBeGreaterThan(luminance(dark['--surface']))
  expect(luminance(light['--fg'])).toBeLessThan(luminance(dark['--fg']))
  expect(luminance(light['--bg'])).toBeGreaterThan(0.9)
  expect(luminance(light['--fg'])).toBeLessThan(0.1)
  for (const name of Object.keys(DARK)) expect(light[name]).not.toBe(dark[name])
})

test('the light-preference media query carries the same values as the explicit light theme', () => {
  const media = /@media \(prefers-color-scheme: light\)\s*\{\s*:root:not\(\[data-theme='dark'\]\)\s*\{([^}]*)\}/.exec(css)
  expect(media).not.toBeNull()
  expect(vars(media![1])).toEqual(vars(rule(`:root[data-theme='light']`)))
})
