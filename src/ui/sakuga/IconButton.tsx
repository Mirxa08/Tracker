import type { ComponentPropsWithRef } from 'react'
import '../../styles/sakuga.css'

export type IconButtonProps = ComponentPropsWithRef<'button'> & {
  /** Required: the glyph is decorative, so the accessible name can only come from here. */
  label: string
}

/**
 * A square button for a single glyph — the "+" controls and the detail panel's close. The
 * glyph is text or inline SVG passed as children; there is no icon package.
 */
export function IconButton({ label, className, type = 'button', children, ...rest }: IconButtonProps) {
  const classes = [
    'sk-icon-btn',
    'inline-flex size-7 shrink-0 items-center justify-center p-0 leading-none',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button {...rest} type={type} className={classes} aria-label={label} title={label}>
      <span aria-hidden="true">{children}</span>
    </button>
  )
}
