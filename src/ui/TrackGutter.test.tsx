import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  addEvent, addTrack, createProject, deleteTrack, renameTrack, reorderTracks, setTrackCollapsed,
} from '../domain/project'
import type { Project } from '../domain/schema'
import { TrackGutter, dropIndex, movedOrder } from './TrackGutter'

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
  const onReorder = vi.fn()
  const onDelete = vi.fn()
  render(
    <TrackGutter
      project={project}
      onAdd={onAdd}
      onToggleCollapse={onToggleCollapse}
      onRename={onRename}
      onReorder={onReorder}
      onDelete={onDelete}
      {...props}
    />,
  )
  return { onToggleCollapse, onAdd, onRename, onReorder, onDelete }
}

/**
 * The gutter with the project actually applied, so a reorder really does move the rows —
 * which is the only way to tell whether the handle keeps focus across the re-render.
 */
function Harness({ initial }: { initial: Project }) {
  const [project, setProject] = useState(initial)
  return (
    <TrackGutter
      project={project}
      onAdd={() => {}}
      onToggleCollapse={(id, collapsed) => setProject((p) => setTrackCollapsed(p, id, collapsed))}
      onRename={(id, name) => setProject((p) => renameTrack(p, id, name))}
      onReorder={(ids) => setProject((p) => reorderTracks(p, ids))}
      onDelete={(id) => setProject((p) => deleteTrack(p, id))}
    />
  )
}

function names(): string[] {
  return screen.getAllByTestId('track-label').map((el) => el.querySelector('.track-label__name')!.textContent!)
}

function announcement(): string {
  const live = screen.getByTestId('track-order-status')
  // The announcement is worthless if it is not in a live region.
  expect(live).toHaveAttribute('aria-live', 'polite')
  return live.textContent ?? ''
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

// ----------------------------------------------------------------------------- reorder ----

test('movedOrder lifts one id out and drops it at the new index', () => {
  expect(movedOrder(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  expect(movedOrder(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  expect(movedOrder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  // Out of range clamps rather than dropping an id: every track must survive a reorder.
  expect(movedOrder(['a', 'b', 'c'], 0, 9)).toEqual(['b', 'c', 'a'])
  expect(movedOrder(['a', 'b', 'c'], 2, -4)).toEqual(['c', 'a', 'b'])
})

test('dropIndex picks the row whose middle the pointer has not passed, at mixed heights', () => {
  // A collapsed row (28px) between two full ones (40px), with the 8px gaps.
  const boxes = [{ top: 100, height: 40 }, { top: 148, height: 28 }, { top: 184, height: 40 }]
  expect(dropIndex(boxes, 100)).toBe(0)
  expect(dropIndex(boxes, 119)).toBe(0)
  expect(dropIndex(boxes, 121)).toBe(1)
  expect(dropIndex(boxes, 161)).toBe(1)
  expect(dropIndex(boxes, 163)).toBe(2)
  expect(dropIndex(boxes, 9999)).toBe(2)
})

test('Alt+ArrowDown moves the track down and keeps focus on the handle for the next press', async () => {
  render(<Harness initial={seeded()} />)
  expect(names()).toEqual(['Banners', 'Combat', 'Patches'])
  screen.getByRole('button', { name: /^Reorder Banners/ }).focus()

  await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
  expect(names()).toEqual(['Combat', 'Banners', 'Patches'])
  expect(announcement()).toBe('Banners moved to position 2 of 3')
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reorder Banners, position 2 of 3' }))

  // The second press continues from where the first left off, without re-focusing anything.
  await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
  expect(names()).toEqual(['Combat', 'Patches', 'Banners'])
  expect(announcement()).toBe('Banners moved to position 3 of 3')
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reorder Banners, position 3 of 3' }))
})

test('Alt+ArrowUp moves the track up', async () => {
  render(<Harness initial={seeded()} />)
  screen.getByRole('button', { name: /^Reorder Patches/ }).focus()
  await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
  expect(names()).toEqual(['Banners', 'Patches', 'Combat'])
  expect(announcement()).toBe('Patches moved to position 2 of 3')
})

test('a move past either end does nothing and announces nothing', async () => {
  render(<Harness initial={seeded()} />)
  screen.getByRole('button', { name: /^Reorder Banners/ }).focus()
  await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
  expect(names()).toEqual(['Banners', 'Combat', 'Patches'])
  expect(announcement()).toBe('')

  screen.getByRole('button', { name: /^Reorder Patches/ }).focus()
  await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
  expect(names()).toEqual(['Banners', 'Combat', 'Patches'])
  expect(announcement()).toBe('')
})

test('the arrows alone are left to the screen reader', async () => {
  render(<Harness initial={seeded()} />)
  screen.getByRole('button', { name: /^Reorder Banners/ }).focus()
  await userEvent.keyboard('{ArrowDown}{ArrowUp}')
  expect(names()).toEqual(['Banners', 'Combat', 'Patches'])
  expect(announcement()).toBe('')
})

/** jsdom measures everything as zero, so the rows are given real boxes to drag between. */
function layOutRows(height = 40, gap = 8) {
  screen.getAllByTestId('track-label').forEach((el, i) => {
    el.getBoundingClientRect = () =>
      ({ top: 100 + i * (height + gap), height, bottom: 100 + i * (height + gap) + height }) as DOMRect
  })
}

test('dragging a handle onto another row reorders, and shows what it is doing', () => {
  render(<Harness initial={seeded()} />)
  layOutRows()
  const handle = screen.getByRole('button', { name: /^Reorder Banners/ })
  fireEvent.pointerDown(handle, { button: 0, clientY: 110 })
  expect(screen.getAllByTestId('track-label')[0].className).toContain('track-label--dragging')

  fireEvent.pointerMove(handle, { clientY: 210 })
  expect(screen.getAllByTestId('track-label')[2].className).toContain('track-label--drop')

  fireEvent.pointerUp(handle, { clientY: 210 })
  expect(names()).toEqual(['Combat', 'Patches', 'Banners'])
  expect(announcement()).toBe('Banners moved to position 3 of 3')
  expect(screen.getAllByTestId('track-label').map((el) => el.className).join(' '))
    .not.toContain('track-label--dragging')
})

test('a drag released where it started changes nothing', () => {
  render(<Harness initial={seeded()} />)
  layOutRows()
  const handle = screen.getByRole('button', { name: /^Reorder Banners/ })
  fireEvent.pointerDown(handle, { button: 0, clientY: 110 })
  fireEvent.pointerMove(handle, { clientY: 115 })
  fireEvent.pointerUp(handle, { clientY: 115 })
  expect(names()).toEqual(['Banners', 'Combat', 'Patches'])
  expect(announcement()).toBe('')
})

test('a cancelled drag drops the preview and changes nothing', () => {
  render(<Harness initial={seeded()} />)
  layOutRows()
  const handle = screen.getByRole('button', { name: /^Reorder Banners/ })
  fireEvent.pointerDown(handle, { button: 0, clientY: 110 })
  fireEvent.pointerMove(handle, { clientY: 210 })
  fireEvent.pointerCancel(handle)
  expect(names()).toEqual(['Banners', 'Combat', 'Patches'])
  expect(screen.getAllByTestId('track-label').map((el) => el.className).join(' '))
    .not.toContain('track-label--drop')
})

// ------------------------------------------------------------------------------ delete ----

async function openConfirm(name = 'Banners') {
  await userEvent.click(screen.getByRole('button', { name: `Delete ${name}` }))
  return screen.getByRole('dialog')
}

test('deleting asks first, naming the track and what goes with it', async () => {
  const { onDelete } = renderGutter(seeded())
  const dialog = await openConfirm()
  expect(dialog).toHaveAccessibleName('Delete “Banners”?')
  expect(dialog).toHaveTextContent('Its 2 events go with it.')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(onDelete).not.toHaveBeenCalled()
})

test('confirming deletes that track, and only then', async () => {
  const project = seeded()
  const { onDelete } = renderGutter(project)
  await openConfirm()
  await userEvent.click(screen.getByRole('button', { name: 'Delete track' }))
  expect(onDelete).toHaveBeenCalledExactlyOnceWith(project.tracks[0].id)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('cancelling deletes nothing and gives focus back to the control that opened it', async () => {
  const { onDelete } = renderGutter(seeded())
  const opener = screen.getByRole('button', { name: 'Delete Banners' })
  await openConfirm()
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onDelete).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
})

test('Escape closes the confirmation without deleting', async () => {
  const { onDelete } = renderGutter(seeded())
  await openConfirm()
  await userEvent.keyboard('{Escape}')
  expect(onDelete).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('the confirmation takes focus and Tab stays inside it', async () => {
  renderGutter(seeded())
  await openConfirm()
  const cancel = screen.getByRole('button', { name: 'Cancel' })
  const confirm = screen.getByRole('button', { name: 'Delete track' })
  expect(document.activeElement).toBe(cancel)
  await userEvent.tab()
  expect(document.activeElement).toBe(confirm)
  await userEvent.tab()
  expect(document.activeElement).toBe(cancel)
  await userEvent.tab({ shift: true })
  expect(document.activeElement).toBe(confirm)
})

test('a track with no events says so rather than counting to zero', async () => {
  renderGutter(seeded())
  expect(await openConfirm('Combat')).toHaveTextContent('It has no events.')
})

test('a track with one event is not asked about in the plural', async () => {
  let project = addTrack(createProject('P'), 'Solo')
  project = addEvent(project, {
    trackId: project.tracks[0].id,
    name: 'Only',
    start: '2026-06-01T00:00:00.000Z',
    end: '2026-06-02T00:00:00.000Z',
  })
  renderGutter(project)
  expect(await openConfirm('Solo')).toHaveTextContent('Its one event goes with it.')
})

test('a confirmed delete takes the row with it', async () => {
  render(<Harness initial={seeded()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Delete Combat' }))
  await userEvent.click(screen.getByRole('button', { name: 'Delete track' }))
  expect(names()).toEqual(['Banners', 'Patches'])
})

test('a right-button press is not a drag', () => {
  render(<Harness initial={seeded()} />)
  layOutRows()
  const handle = screen.getByRole('button', { name: /^Reorder Banners/ })
  fireEvent.pointerDown(handle, { button: 2, clientY: 110 })
  fireEvent.pointerMove(handle, { clientY: 210 })
  fireEvent.pointerUp(handle, { clientY: 210 })
  expect(names()).toEqual(['Banners', 'Combat', 'Patches'])
})
