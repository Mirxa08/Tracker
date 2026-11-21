/**
 * The primitives Sakuga UI does not provide. Sakuga UI's catalog is heroes, effects and
 * layouts; an app bar, dialog, select, inputs, badge and side panel are ours to build, in
 * its visual language. See src/styles/sakuga.css for the credit and the licence.
 *
 * `fx` is the other Sakuga: the vendored finktheartist/sakuga-vfx core, wrapped. It is the
 * only route to window.SakugaFX and it no-ops when that global is absent — see fx.ts.
 */
export {
  animating, clack, core, crack, dust, impact, land, pop, quietPress, shatter, slashAt,
  spark, squash, trail,
} from './fx'
export type { FxBox, FxLettering, FxSquash, SakugaCore } from './fx'
export { SpotlightSurface, spotlightProps, trackSpotlight } from './SpotlightSurface'
export type { SpotlightSurfaceProps } from './SpotlightSurface'
export { Button } from './Button'
export type { ButtonProps, ButtonVariant } from './Button'
export { IconButton } from './IconButton'
export type { IconButtonProps } from './IconButton'
export { Field, Input } from './Field'
export type { FieldProps, FieldControlProps, InputProps } from './Field'
export { Select } from './Select'
export type { SelectProps } from './Select'
export { Badge } from './Badge'
export type { BadgeProps } from './Badge'
export { Panel } from './Panel'
export type { PanelProps } from './Panel'
export { Segmented } from './Segmented'
export type { SegmentedOption, SegmentedProps } from './Segmented'
