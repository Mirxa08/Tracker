import type { ComponentPropsWithoutRef } from 'react'
import '../../styles/sakuga.css'

export type ButtonVariant = 'primary' | 'quiet' | 'danger'

export type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant
}

/**
 * A text button in three weights. `type` defaults to "button": a bare <button> inside a form
 * submits it, which is never what a toolbar control means.
 *
 * Hover scales to 1.02 and active to 0.98 over --t-fast, both dropped under
 * prefers-reduced-motion (sakuga.css).
 */
export function Button({ variant = 'quiet', className, type = 'button', ...rest }: ButtonProps) {
  const classes = [
    'sk-btn',
    `sk-btn--${variant}`,
    // Layout and type come from Tailwind; colour, radius and motion from sakuga.css.
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium whitespace-nowrap',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button {...rest} type={type} className={classes} />
}
