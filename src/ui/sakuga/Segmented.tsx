import { useId } from 'react'
import '../../styles/sakuga.css'

export type SegmentedOption<T extends string> = { value: T; label: string }

export type SegmentedProps<T extends string> = {
  /** Names the group for screen readers; there is no visible legend in a bar this dense. */
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
}

/**
 * A small pill-shaped multi-way control — the theme switch.
 *
 * Real radio inputs inside a radiogroup, with the labels doing the painting: arrow-key
 * movement, the "2 of 3" announcement and click-to-select are the platform's. The inputs are
 * clipped rather than hidden with display:none, so focus still lands on them and the ring
 * shows on the label next to them.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  const name = useId()
  return (
    <div
      className={['sk-seg', className].filter(Boolean).join(' ')}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => {
        const id = `${name}-${option.value}`
        return (
          <span className="sk-seg__item" key={option.value}>
            <input
              className="sk-seg__input"
              type="radio"
              id={id}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <label className="sk-seg__label px-2.5 py-0.5 text-xs font-medium" htmlFor={id}>
              {option.label}
            </label>
          </span>
        )
      })}
    </div>
  )
}
