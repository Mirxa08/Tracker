import { expect, test } from 'vitest'
// Read as text, not executed: these are the vendored artifact, the page that loads it and
// the config that decides the URL it loads from.
import core from '../../../public/sakuga-vfx/core.js?raw'
import licence from '../../../public/sakuga-vfx/LICENSE?raw'
import index from '../../../index.html?raw'
import config from '../../../vite.config.ts?raw'

/**
 * The vendored core and its loader. There is no package to pin, so this file is the pin:
 * it asserts the copy is byte-identical to the upstream commit it claims, and that the one
 * script tag that loads it is the shape the file needs and the sub-path requires.
 */

const COMMIT = 'c3dabb173928a3ad2372183103caf2e6f50953d0'
/** sha256 of core.js at that commit, taken from raw.githubusercontent.com. */
const UPSTREAM_SHA256 = 'f0518dd7d4dd1986eab2c9c76796421f4c827e91eac627f4c91a63c362c79419'
/** The first line of the upstream artifact, which is where the prepended header ends. */
const BODY_MARKER = '// Sakuga VFX core: springs,'

const body = core.slice(core.indexOf(BODY_MARKER))

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

test('the vendored copy credits Sakuga VFX, its author, the licence and the pinned commit', () => {
  expect(core).toContain('https://github.com/finktheartist/sakuga-vfx')
  expect(core).toContain('Justin Finkelman')
  expect(core).toContain('MIT')
  expect(core).toContain(COMMIT)
  // The licence text itself sits beside it rather than being paraphrased.
  expect(licence).toContain('MIT License')
  expect(licence).toContain('Justin Finkelman')
  expect(licence).toContain(COMMIT)
})

test('everything under the header is upstream byte for byte, so the copy is diffable', async () => {
  expect(core.indexOf(BODY_MARKER)).toBeGreaterThan(0)
  expect(await sha256(body)).toBe(UPSTREAM_SHA256)
  // Ends where upstream ends, with the IIFE closed: a hash computed from a truncated
  // download would have matched that truncated file, so the recorded hash is the upstream
  // one and this is the shape it has to have.
  expect(body.trimEnd().endsWith('})();')).toBe(true)
  expect(body).toContain('window.SakugaFX')
})

test('index.html loads it as a classic script under the app\'s base path', () => {
  const tag = /<script([^>]*)\ssrc="([^"]*sakuga-vfx\/core\.js)"([^>]*)>/.exec(index)
  expect(tag).not.toBeNull()
  const [, before, src, after] = tag!
  // A module would be deferred and is not what the file expects.
  expect(`${before}${after}`).not.toMatch(/type\s*=/)
  // Document-relative, and not a bare "/": under /Tracker/ a root-absolute src is a 404
  // that only appears in production, which is the mistake this line is written to avoid.
  // Nor %BASE_URL%, which is right in the build but has the base prepended a second time
  // by the dev server, so the core silently 404s at /Tracker/Tracker/... while developing.
  expect(src).toBe('./sakuga-vfx/core.js')
  expect(src.startsWith('/')).toBe(false)
  // And it loads before the app's own entry, so the global is set by the time React mounts.
  expect(index.indexOf('sakuga-vfx/core.js')).toBeLessThan(index.indexOf('src/main.tsx'))
})

test('the base the site is served from is the one the deploy publishes', () => {
  // Straight from the config. The core's own src is document-relative so it follows the
  // base automatically, but the app entry does not, so a change here is worth catching.
  expect(config).toMatch(/base:\s*'\/Tracker\/'/)
})

test('nothing in the core reaches the network at runtime', () => {
  // Offline-capable: served from our own origin, no CDN, no web font, no analytics.
  expect(body).not.toMatch(/https?:\/\//)
  expect(body).not.toMatch(/\bfetch\s*\(/)
  expect(body).not.toMatch(/XMLHttpRequest|importScripts|@import|new Worker/)
})
