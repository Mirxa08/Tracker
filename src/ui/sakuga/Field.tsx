import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import { dust } from './fx'
import '../../styles/sakuga.css'

/** What a Field hands its control: the id its label points at, plus the error wiring. */
export type FieldControlProps = {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

export type FieldProps = {
  label: string
  /** Error text shown under the control and announced through aria-describedby. */
  error?: string
  /** Mark the control invalid without repeating the message (the dialog shows one alert). */
  invalid?: boolean
  className?: string
  children: (control: FieldControlProps) => ReactNode
}

/**
 * Label + control + error text, so the dialog stops hand-rolling that layout.
 *
 * The control is a render prop rather than plain children because the label must point at a
 * real id: that keeps a native <label for> tie (and the click-to-focus and screen-reader
 * naming that come with it) whichever of Input or Select is inside.
 */
export function Field({ label, error, invalid, className, children }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const control: FieldControlProps = { id }
  if (error) control['aria-describedby'] = errorId
  if (error || invalid) control['aria-invalid'] = true
  return (
    <div className={['sk-field', 'grid gap-1', className].filter(Boolean).join(' ')}>
      <label className="sk-field__label text-xs font-medium tracking-wide" htmlFor={id}>
        {label}
      </label>
      {children(control)}
      {error && <p className="sk-field__error text-xs" id={errorId}>{error}</p>}
    </div>
  )
}

export type InputProps = ComponentPropsWithRef<'input'>

/** Input types with no caret to kick dust up from. */
const NO_CARET = new Set(['file', 'color', 'checkbox', 'radio', 'range', 'image', 'submit'])

/**
 * Where the caret is, as a fraction of the way across the field, so the dust lands under
 * the text being typed rather than in the middle of the box. The character count is the
 * best proxy available without measuring glyphs, and for a puff of smoke it is enough.
 */
function caretFraction(el: HTMLInputElement): number {
  const length = el.value.length
  if (length === 0) return 0
  // selectionStart is null on an input type that does not support selection.
  const caret = el.selectionStart ?? length
  return Math.min(1, caret / length)
}

/**
 * A text, datetime-local, colour or file input with the shared finish: radius --r-sm, the
 * translucent surface, and the same visible focus ring as every other control.
 *
 * Typing kicks up a little dust at the caret, as upstream's input does. It is throttled in
 * fx.ts (one puff per keystroke, not one per repeat-key frame), skipped for the types that
 * have no caret, and absent entirely in jsdom and under reduced motion.
 */
export function Input({ className, onKeyDown, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      onKeyDown={(event) => {
        const el = event.currentTarget
        // Printable keys and the two that visibly eat text; not Tab, Escape or the arrows,
        // which move around the field without changing it.
        const types = event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete'
        if (types && !NO_CARET.has(el.type)) dust(el, caretFraction(el))
        onKeyDown?.(event)
      }}
      className={['sk-input', 'w-full px-2 py-1.5 text-sm', className].filter(Boolean).join(' ')}
    />
  )
}
