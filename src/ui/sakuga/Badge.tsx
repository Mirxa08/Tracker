import type { ComponentPropsWithoutRef } from 'react'
import '../../styles/sakuga.css'

export type BadgeProps = ComponentPropsWithoutRef<'span'>

/**
 * The pill for a short piece of monospaced data — the remaining-time label on a bar and the
 * now-line's clock. --r-pill, tabular monospace, and a blurred backdrop so it stays readable
 * over any bar colour or artwork.
 */
export function Badge({ className, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={['sk-badge', 'px-2 py-px text-[11px] leading-snug', className].filter(Boolean).join(' ')}
    />
  )
}
