import { act, render } from '@testing-library/react'
import type { Theme } from '../domain/schema'
import { LIGHT_QUERY, resolveTheme, useAppliedTheme } from './useTheme'

/** A matchMedia whose answer can be changed, with the listeners a real one would notify. */
function stubMatchMedia(prefersLight: boolean) {
  const listeners = new Set<() => void>()
  const query = {
    matches: prefersLight,
    media: LIGHT_QUERY,
    addEventListener: (_type: string, fn: () => void) => { listeners.add(fn) },
    removeEventListener: (_type: string, fn: () => void) => { listeners.delete(fn) },
  }
  const matchMedia = vi.fn((media: string) => {
    expect(media).toBe(LIGHT_QUERY)
    return query as unknown as MediaQueryList
  })
  window.matchMedia = matchMedia as unknown as typeof window.matchMedia
  return {
    query,
    listeners,
    /** What the platform does when the user switches their OS appearance. */
    force(light: boolean) {
      query.matches = light
      act(() => { for (const fn of [...listeners]) fn() })
    },
  }
}

const original = window.matchMedia

afterEach(() => {
  window.matchMedia = original
  delete document.documentElement.dataset.theme
})

function Themed({ theme }: { theme: Theme }) {
  useAppliedTheme(theme)
  return null
}

test('resolveTheme: an explicit choice wins, and system falls back to dark', () => {
  expect(resolveTheme('dark', true)).toBe('dark')
  expect(resolveTheme('light', false)).toBe('light')
  expect(resolveTheme('system', true)).toBe('light')
  expect(resolveTheme('system', false)).toBe('dark')
})

test('each setting writes the matching data-theme on the document root', () => {
  stubMatchMedia(false)
  const { rerender, unmount } = render(<Themed theme="dark" />)
  expect(document.documentElement.dataset.theme).toBe('dark')
  rerender(<Themed theme="light" />)
  expect(document.documentElement.dataset.theme).toBe('light')
  rerender(<Themed theme="system" />)
  expect(document.documentElement.dataset.theme).toBe('dark')
  unmount()
})

test('a system project follows a forced light signal, before and after mount', () => {
  const media = stubMatchMedia(true)
  const { unmount } = render(<Themed theme="system" />)
  expect(document.documentElement.dataset.theme).toBe('light')
  media.force(false)
  expect(document.documentElement.dataset.theme).toBe('dark')
  media.force(true)
  expect(document.documentElement.dataset.theme).toBe('light')
  unmount()
  // The listener goes with the component, or a second mount would leave two writing.
  expect(media.listeners.size).toBe(0)
})

test('an explicit theme ignores the platform entirely', () => {
  const media = stubMatchMedia(false)
  render(<Themed theme="dark" />)
  // Nothing is listening, so a platform change cannot move an explicit choice.
  expect(media.listeners.size).toBe(0)
  media.force(true)
  expect(document.documentElement.dataset.theme).toBe('dark')
})

test('the attribute is always written, so theme.css never falls back to its media query', () => {
  stubMatchMedia(true)
  // An inherited attribute from an earlier visit must be corrected, not left alone.
  document.documentElement.dataset.theme = 'light'
  render(<Themed theme="dark" />)
  expect(document.documentElement.dataset.theme).toBe('dark')
})
