import type { ComponentPropsWithoutRef, ElementType, MouseEvent } from 'react'
import '../../styles/sakuga.css'

/**
 * The cursor tracker behind every Sakuga surface, reproduced from Sakuga UI's SpotlightGrid:
 * the element carries --mouse-x / --mouse-y, the cursor position minus the element's
 * bounding-rect origin, and the CSS paints both glows from them.
 *
 * Written straight onto the node's style rather than through state: a bar being dragged, or
 * sixty bars on a timeline, must not re-render React on every mouse move.
 *
 * This lives here once; nothing else in the app installs a mousemove handler for the glow.
 */
export function trackSpotlight(event: MouseEvent<HTMLElement>): void {
  const el = event.currentTarget
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`)
  el.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`)
}

/** The class list and handler any element needs to become a spotlight surface. */
export function spotlightProps(extra?: string, grid = false): {
  className: string
  onMouseMove: (event: MouseEvent<HTMLElement>) => void
} {
  return {
    className: ['sk-spotlight', grid && 'sk-spotlight--grid', extra].filter(Boolean).join(' '),
    onMouseMove: trackSpotlight,
  }
}

export type SpotlightSurfaceProps = ComponentPropsWithoutRef<'div'> & {
  /** The tag to render. Restricted on purpose: this is a surface, not a layout primitive. */
  as?: 'div' | 'section' | 'aside' | 'header' | 'li'
  /** Paint the faint 20px grid texture under the surface. */
  grid?: boolean
}

/**
 * A translucent, rounded, bordered surface with the cursor-tracked inner and border glow.
 * Every other Sakuga component composes it, and EventBar borrows `spotlightProps` directly
 * because a bar must stay a single <button>.
 */
export function SpotlightSurface({
  as = 'div',
  grid = false,
  className,
  onMouseMove,
  ...rest
}: SpotlightSurfaceProps) {
  const Tag = as as ElementType
  const spotlight = spotlightProps(className, grid)
  return (
    <Tag
      {...rest}
      className={spotlight.className}
      onMouseMove={(event: MouseEvent<HTMLElement>) => {
        spotlight.onMouseMove(event)
        onMouseMove?.(event as MouseEvent<HTMLDivElement>)
      }}
    />
  )
}
