import { useEffect } from 'react'
import type { Theme } from '../domain/schema'

/** The media query 'system' resolves through. Light is the signal; no signal means dark. */
export const LIGHT_QUERY = '(prefers-color-scheme: light)'

/**
 * Which palette a setting actually means. Ruling 25: dark is the default, so 'system'
 * resolves to dark unless the platform asks for light.
 */
export function resolveTheme(theme: Theme, prefersLight: boolean): 'dark' | 'light' {
  if (theme === 'dark' || theme === 'light') return theme
  return prefersLight ? 'light' : 'dark'
}

/**
 * Applies the project's theme to data-theme on the document root, which is what theme.css
 * keys its palettes off. A 'system' project follows the platform live: the listener is only
 * attached for 'system', because for an explicit choice a platform change means nothing.
 *
 * The attribute is always written, never left absent: without it theme.css would fall back
 * to its media query, which is how the setting came to look implemented while being dead.
 */
export function useAppliedTheme(theme: Theme): void {
  useEffect(() => {
    const query = window.matchMedia?.(LIGHT_QUERY)
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme, query?.matches ?? false)
    }
    apply()
    if (theme !== 'system' || !query?.addEventListener) return
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [theme])
}
