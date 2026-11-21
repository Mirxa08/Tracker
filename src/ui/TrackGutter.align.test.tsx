import { render, screen } from '@testing-library/react'
import { addEvent, addTrack, createProject, setTrackCollapsed } from '../domain/project'
import { Timeline } from './Timeline'
// The custom properties the row rules read live on :root here, so the heights resolve to
// real pixels rather than to the literal `var(...)` jsdom would otherwise hand back.
import '../styles/theme.css'

function seeded() {
  const now = Date.now()
  let p = addTrack(createProject('Wuthering Waves'), 'Banners')
  p = addTrack(p, 'Combat')
  p = addEvent(p, {
    trackId: p.tracks[0].id,
    name: 'Lily Banner',
    start: new Date(now - 2 * 86_400_000).toISOString(),
    end: new Date(now + 10 * 86_400_000).toISOString(),
  })
  return p
}

/**
 * jsdom does not substitute custom properties, so a computed `height` comes back as
 * `var(--row-height)`. Resolving it against :root turns both columns' declarations into the
 * pixel values a browser would use — which is the thing that has to match.
 */
function pixels(el: Element, property: 'height' | 'marginBottom'): string {
  const root = getComputedStyle(document.documentElement)
  const raw = getComputedStyle(el)[property]
  const resolved = raw.replace(/var\((--[\w-]+)\)/g, (_, name: string) =>
    root.getPropertyValue(name).trim())
  // A reading that is still a var(), or empty, would make any equality below vacuous.
  expect(resolved).toMatch(/^\d+(\.\d+)?px$/)
  return resolved
}

function rowBoxes() {
  const labels = screen.getAllByTestId('track-label')
  const rows = screen.getAllByTestId('track-row')
  expect(labels).toHaveLength(rows.length)
  return labels.map((label, i) => ({
    label: { height: pixels(label, 'height'), gap: pixels(label, 'marginBottom') },
    row: { height: pixels(rows[i], 'height'), gap: pixels(rows[i], 'marginBottom') },
  }))
}

test('an expanded track is the same height in the gutter and in the canvas', () => {
  render(<Timeline project={seeded()} />)
  for (const { label, row } of rowBoxes()) {
    expect(label.height).toBe(row.height)
    expect(label.gap).toBe(row.gap)
  }
})

test('a collapsed track is the same, slimmer, height in the gutter and in the canvas', () => {
  const project = seeded()
  const { rerender } = render(<Timeline project={project} />)
  const expanded = rowBoxes()[0]
  rerender(<Timeline project={setTrackCollapsed(project, project.tracks[0].id, true)} />)
  const [first, second] = rowBoxes()

  // Collapsed: still equal across the two columns, and genuinely slimmer than before.
  expect(first.label.height).toBe(first.row.height)
  expect(first.label.gap).toBe(first.row.gap)
  expect(parseFloat(first.label.height)).toBeLessThan(parseFloat(expanded.label.height))

  // The track below it is untouched, which is what keeps the two columns in step.
  expect(second.label.height).toBe(second.row.height)
  expect(second.label.height).toBe(expanded.label.height)
})

test('the cumulative offset of every row matches between the two columns, collapsed or not', () => {
  const project = seeded()
  render(<Timeline project={setTrackCollapsed(project, project.tracks[0].id, true)} />)
  let labelTop = 0
  let rowTop = 0
  for (const { label, row } of rowBoxes()) {
    expect(labelTop).toBe(rowTop)
    labelTop += parseFloat(label.height) + parseFloat(label.gap)
    rowTop += parseFloat(row.height) + parseFloat(row.gap)
  }
  expect(labelTop).toBe(rowTop)
})

test('a collapsed track renders no event bars, and expanding brings them back', () => {
  const project = seeded()
  const { rerender } = render(<Timeline project={project} />)
  expect(screen.getAllByTestId('track-row')[0].querySelectorAll('.event-bar')).toHaveLength(1)
  rerender(<Timeline project={setTrackCollapsed(project, project.tracks[0].id, true)} />)
  expect(screen.getAllByTestId('track-row')[0].querySelectorAll('.event-bar')).toHaveLength(0)
  rerender(<Timeline project={project} />)
  expect(screen.getAllByTestId('track-row')[0].querySelectorAll('.event-bar')).toHaveLength(1)
})
