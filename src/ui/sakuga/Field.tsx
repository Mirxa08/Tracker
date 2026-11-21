import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
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

/**
 * A text, datetime-local, colour or file input with the shared finish: radius --r-sm, the
 * translucent surface, and the same visible focus ring as every other control.
 */
export function Input({ className, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={['sk-input', 'w-full px-2 py-1.5 text-sm', className].filter(Boolean).join(' ')}
    />
  )
}
