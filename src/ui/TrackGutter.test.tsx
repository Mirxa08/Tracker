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
  const onRename = vi.fn()
  render(
    <TrackGutter
      project={project}
      onAdd={onAdd}
      onToggleCollapse={onToggleCollapse}
      onRename={onRename}
      {...props}
    />,
  )
  return { onToggleCollapse, onAdd, onRename }
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

// ------------------------------------------------------------------------------ rename ----

async function startRename(name = 'Banners') {
  await userEvent.click(screen.getByRole('button', { name: `Rename ${name}` }))
  return screen.getByRole('textbox', { name: 'Track name' })
}

test('the pencil turns the label into a field holding the current name', async () => {
  renderGutter(seeded())
  const input = await startRename()
  expect(input).toHaveValue('Banners')
  expect(input).toHaveFocus()
})

test('Enter commits the new name', async () => {
  const project = seeded()
  const { onRename } = renderGutter(project)
  const input = await startRename()
  await userEvent.clear(input)
  await userEvent.type(input, 'Character Banners{Enter}')
  expect(onRename).toHaveBeenCalledWith(project.tracks[0].id, 'Character Banners')
  expect(screen.queryByRole('textbox', { name: 'Track name' })).toBeNull()
})

test('Escape cancels and restores the previous name', async () => {
  const { onRename } = renderGutter(seeded())
  const input = await startRename()
  await userEvent.clear(input)
  await userEvent.type(input, 'Something else{Escape}')
  expect(onRename).not.toHaveBeenCalled()
  expect(screen.getByText('Banners')).toBeInTheDocument()
  // The field is gone, and the blur that follows must not commit what Escape discarded.
  expect(screen.queryByRole('textbox', { name: 'Track name' })).toBeNull()
})

test('losing focus commits', async () => {
  const project = seeded()
  const { onRename } = renderGutter(project)
  const input = await startRename()
  await userEvent.clear(input)
  await userEvent.type(input, 'Weapons')
  await userEvent.tab()
  expect(onRename).toHaveBeenCalledWith(project.tracks[0].id, 'Weapons')
})

test('an empty name is refused and the old one kept, on Enter and on blur', async () => {
  const { onRename } = renderGutter(seeded())
  const first = await startRename()
  await userEvent.clear(first)
  await userEvent.type(first, '{Enter}')
  expect(onRename).not.toHaveBeenCalled()
  expect(screen.getByText('Banners')).toBeInTheDocument()

  const second = await startRename()
  await userEvent.clear(second)
  await userEvent.tab()
  expect(onRename).not.toHaveBeenCalled()
  expect(screen.getByText('Banners')).toBeInTheDocument()
})

test('a whitespace-only name is refused, and a padded one is trimmed', async () => {
  const project = seeded()
  const { onRename } = renderGutter(project)
  const blank = await startRename()
  await userEvent.clear(blank)
  await userEvent.type(blank, '   {Enter}')
  expect(onRename).not.toHaveBeenCalled()
  expect(screen.getByText('Banners')).toBeInTheDocument()

  const padded = await startRename()
  await userEvent.clear(padded)
  await userEvent.type(padded, '  Weapons  {Enter}')
  expect(onRename).toHaveBeenCalledExactlyOnceWith(project.tracks[0].id, 'Weapons')
})

test('committing the name unchanged asks for nothing', async () => {
  const { onRename } = renderGutter(seeded())
  const input = await startRename()
  await userEvent.type(input, '{Enter}')
  expect(onRename).not.toHaveBeenCalled()
})
