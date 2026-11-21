import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addEvent, addTrack, createProject, setTrackCollapsed } from '../domain/project'
import type { Project } from '../domain/schema'
import { TrackGutter } from './TrackGutter'

function seeded(): Project {
  const now = Date.now()
  let p = addTrack(createProject('Wuthering Waves'), 'Banners')
  p = addTrack(p, 'Combat')
  p = addTrack(p, 'Patches')
  for (const name of ['Lily Banner', 'Cantarella Banner']) {
    p = addEvent(p, {
      trackId: p.tracks[0].id,
      name,
      start: new Date(now).toISOString(),
      end: new Date(now + 86_400_000).toISOString(),
    })
  }
  return p
}

function renderGutter(project: Project, props: Partial<Parameters<typeof TrackGutter>[0]> = {}) {
  const onToggleCollapse = vi.fn()
  const onAdd = vi.fn()
  render(
    <TrackGutter
      project={project}
      onAdd={onAdd}
      onToggleCollapse={onToggleCollapse}
      {...props}
    />,
  )
  return { onToggleCollapse, onAdd }
}

test('the chevron asks for the opposite of the track\'s current state', async () => {
  const project = seeded()
  const { onToggleCollapse } = renderGutter(project)
  await userEvent.click(screen.getByRole('button', { name: 'Collapse Banners' }))
  expect(onToggleCollapse).toHaveBeenCalledWith(project.tracks[0].id, true)
})

test('a collapsed track offers to expand, and says how many events it is hiding', async () => {
  const project = seeded()
  const collapsed = setTrackCollapsed(project, project.tracks[0].id, true)
  const { onToggleCollapse } = renderGutter(collapsed)
  const chevron = screen.getByRole('button', { name: 'Expand Banners' })
  expect(chevron).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByLabelText('2 events')).toHaveTextContent('2')
  // The name is still there: a slim row the user cannot read is no use.
  expect(screen.getByText('Banners')).toBeInTheDocument()
  await userEvent.click(chevron)
  expect(onToggleCollapse).toHaveBeenCalledWith(project.tracks[0].id, false)
})

test('an expanded track shows no count and reports itself as expanded', () => {
  renderGutter(seeded())
  expect(screen.getByRole('button', { name: 'Collapse Banners' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.queryByLabelText(/events?$/)).toBeNull()
})

test('a track with one event says "1 event"', () => {
  let project = addTrack(createProject('P'), 'Solo')
  project = addEvent(project, {
    trackId: project.tracks[0].id,
    name: 'Only',
    start: '2026-06-01T00:00:00.000Z',
    end: '2026-06-02T00:00:00.000Z',
  })
  renderGutter(setTrackCollapsed(project, project.tracks[0].id, true))
  expect(screen.getByLabelText('1 event')).toBeInTheDocument()
})

test('the add-event button still reports its own track', async () => {
  const project = seeded()
  const { onAdd } = renderGutter(project)
  await userEvent.click(screen.getByRole('button', { name: 'Add event to Combat' }))
  expect(onAdd).toHaveBeenCalledWith(project.tracks[1].id)
})
