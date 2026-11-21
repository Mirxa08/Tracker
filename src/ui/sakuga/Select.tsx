import type { ComponentPropsWithoutRef } from 'react'
import '../../styles/sakuga.css'

export type SelectProps = ComponentPropsWithoutRef<'select'>

/**
 * A native <select>, restyled to match Input: same radius, surface and focus ring, with the
 * chevron drawn as a CSS background so no icon package is needed.
 *
 * Deliberately not a custom popup listbox. The native control brings typeahead, arrow keys,
 * the platform's own touch picker and correct screen-reader announcement for free; a div
 * listbox would have to re-earn all of it.
 */
export function Select({ className, ...rest }: SelectProps) {
  return (
    <select
      {...rest}
      className={['sk-select', 'w-full py-1.5 pr-7 pl-2 text-sm', className].filter(Boolean).join(' ')}
    />
  )
}
