import type { ComponentPropsWithoutRef, ElementType, MouseEvent, Ref } from 'react'
import { spotlightProps } from './SpotlightSurface'
import '../../styles/sakuga.css'

export type PanelProps = Omit<ComponentPropsWithoutRef<'form'>, 'ref'> & {
  /** The tag to render: the detail panel is an <aside>, the dialog body a <form>. */
  as?: 'div' | 'section' | 'aside' | 'form'
  ref?: Ref<HTMLElement>
}

/**
 * The large rounded container — the detail panel and the dialog body. --r-lg, an opaque
 * background (it sits over the timeline or a backdrop, so it must occlude), a translucent
 * border, and the same cursor-tracked border glow as every other Sakuga surface.
 *
 * Layout (position, padding, grid) stays with the caller's own class, which is passed
 * straight through; this component contributes the finish only.
 */
export function Panel({ as = 'div', className, onMouseMove, ...rest }: PanelProps) {
  const Tag = as as ElementType
  const spotlight = spotlightProps(['sk-panel', className].filter(Boolean).join(' '))
  return (
    <Tag
      {...rest}
      className={spotlight.className}
      onMouseMove={(event: MouseEvent<HTMLElement>) => {
        spotlight.onMouseMove(event)
        onMouseMove?.(event as MouseEvent<HTMLFormElement>)
      }}
    />
  )
}
