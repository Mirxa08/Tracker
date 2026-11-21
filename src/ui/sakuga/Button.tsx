import { useCallback, useRef, type ComponentPropsWithoutRef } from 'react'
import { clack, impact, quietPress, shatter, squash } from './fx'
import '../../styles/sakuga.css'

export type ButtonVariant = 'primary' | 'quiet' | 'danger'

/**
 * Which anime reaction the press fires. One change here reaches every button in the app,
 * which is the point of hanging it off this component rather than off each call site.
 *
 *   impact  — the squash, the burst and ドン!. The loud one: a real action landing.
 *   quiet   — smoke and a tick fan, no lettering. Cancel, Close, anything reversible.
 *   shatter — crystals and ズザッ. Something is being destroyed.
 *   clack   — a hollow カチ and nothing else. A small correction, like Undo.
 *   none    — the squash only.
 */
export type ButtonFx = 'impact' | 'quiet' | 'shatter' | 'clack' | 'none'

export type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant
  fx?: ButtonFx
}

/**
 * What each weight reacts with unless the call site asks for something else. A danger
 * button is always destroying something, so it shatters; a primary one is the action the
 * screen is for, so it gets the impact frame. Everything else stays quiet, which is what
 * keeps the loud one meaningful — a page where every control shouts has no impact frame at
 * all. The toolbar's named actions (New project, Add track, Now, Export) ask for `impact`
 * explicitly, because they are primary actions painted in the quiet weight.
 */
const BY_VARIANT: Record<ButtonVariant, ButtonFx> = {
  primary: 'impact',
  quiet: 'quiet',
  danger: 'shatter',
}

const FIRE: Record<Exclude<ButtonFx, 'none'>, (el: HTMLElement) => void> = {
  impact,
  quiet: quietPress,
  shatter,
  clack,
}

/**
 * A text button in three weights. `type` defaults to "button": a bare <button> inside a
 * form submits it, which is never what a toolbar control means.
 *
 * Hover scales to 1.02 and active to 0.98 over --t-fast, both dropped under
 * prefers-reduced-motion (sakuga.css). On top of that it squashes under the pointer and
 * fires its effect on release — both through src/ui/sakuga/fx.ts, so both are silently
 * absent in jsdom and under reduced motion.
 */
export function Button({
  variant = 'quiet',
  className,
  type = 'button',
  fx,
  onClick,
  ...rest
}: ButtonProps) {
  const effect = fx ?? BY_VARIANT[variant]
  const node = useRef<HTMLButtonElement | null>(null)
  const mount = useCallback((el: HTMLButtonElement | null) => {
    node.current = el
    // Idempotent: squash() ignores an element it has already sprung.
    squash(el)
  }, [])
  const classes = [
    'sk-btn',
    `sk-btn--${variant}`,
    // Layout and type come from Tailwind; colour, radius and motion from sakuga.css.
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium whitespace-nowrap',
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
      onClick={(event) => {
        // The effect reads the element's box, so it fires BEFORE the handler: a handler
        // that unmounts this button (Cancel, Delete, anything that closes a dialog) would
        // otherwise leave nothing to measure and the frame would land at 0,0.
        if (effect !== 'none' && node.current) FIRE[effect](node.current)
        onClick?.(event)
      }}
    />
  )
}
