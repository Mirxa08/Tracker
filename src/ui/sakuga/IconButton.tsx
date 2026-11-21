import { useCallback, useRef, type ComponentPropsWithRef } from 'react'
import { quietPress, squash } from './fx'
import '../../styles/sakuga.css'

export type IconButtonProps = ComponentPropsWithRef<'button'> & {
  /** Required: the glyph is decorative, so the accessible name can only come from here. */
  label: string
}

/**
 * A square button for a single glyph — the "+" controls and the detail panel's close. The
 * glyph is text or inline SVG passed as children; there is no icon package.
 *
 * It squashes under the pointer and puffs a little smoke on release — the quiet reaction,
 * never the lettering: there are five of these in every gutter row, and a ドン! from each
 * would leave the loud ones meaningless. The destructive one (×) opens a confirmation whose
 * own danger button is what shatters.
 */
export function IconButton({ label, className, type = 'button', children, ref, ...rest }: IconButtonProps) {
  const node = useRef<HTMLButtonElement | null>(null)
  // The caller's ref still has to be honoured: the gutter keeps the reorder handles by ref
  // so a keyboard move can focus the row it just moved.
  const mount = useCallback((el: HTMLButtonElement | null) => {
    node.current = el
    squash(el)
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }, [ref])
  const classes = [
    'sk-icon-btn',
    'inline-flex size-7 shrink-0 items-center justify-center p-0 leading-none',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      {...rest}
      ref={mount}
      type={type}
      className={classes}
      aria-label={label}
      title={label}
      onClick={(event) => {
        if (node.current) quietPress(node.current)
        rest.onClick?.(event)
      }}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
}
