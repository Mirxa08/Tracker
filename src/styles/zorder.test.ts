import barCss from './event-bar.css?raw'
import timelineCss from './timeline.css?raw'

/** z-index declared by the first rule whose selector is exactly `selector`. */
function zIndexOf(css: string, selector: string): number {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = new RegExp(`(?:^|[}/])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1]
  const match = block?.match(/z-index:\s*(\d+)/)
  if (!match) throw new Error(`no z-index for ${selector}`)
  return Number(match[1])
}

// jsdom computes no stacking, so this pins the declared scale; the painted result was checked in a browser.
test('z-order scale: bars < now-line < bands < gutter < corner', () => {
  const bar = zIndexOf(barCss, '.event-bar')
  const now = zIndexOf(timelineCss, '.now-line')
  const bands = zIndexOf(timelineCss, '.bands')
  const gutter = zIndexOf(timelineCss, '.timeline__gutter')
  const corner = zIndexOf(timelineCss, '.timeline__corner')
  expect(bar).toBeLessThan(now)
  expect(now).toBeLessThan(bands)
  expect(bands).toBeLessThan(gutter)
  expect(gutter).toBeLessThan(corner)
})
