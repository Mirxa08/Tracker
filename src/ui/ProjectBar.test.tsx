import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createProject } from '../domain/project'
import { ProjectBar } from './ProjectBar'

const projects = [createProject('Wuthering Waves'), createProject('Genshin')]

function renderBar(overrides: Partial<Parameters<typeof ProjectBar>[0]> = {}) {
  const props = {
    projects,
    currentId: projects[0].id,
    theme: 'dark' as const,
    onChangeTheme: vi.fn(),
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onAddTrack: vi.fn(),
    onAddEvent: vi.fn(),
    onImport: vi.fn(),
    onExport: vi.fn(),
    onJumpToNow: vi.fn(),
    ...overrides,
  }
  render(<ProjectBar {...props} />)
  return props
}

test('lists every project and marks the current one', () => {
  renderBar()
  const select = screen.getByLabelText(/project/i) as HTMLSelectElement
  expect(select.value).toBe(projects[0].id)
  expect(screen.getByRole('option', { name: 'Genshin' })).toBeInTheDocument()
})

test('switching the select reports the chosen project', async () => {
  const props = renderBar()
  await userEvent.selectOptions(screen.getByLabelText(/project/i), projects[1].id)
  expect(props.onSelect).toHaveBeenCalledWith(projects[1].id)
})

test('the add-event button reports the request', async () => {
  const props = renderBar()
  await userEvent.click(screen.getByRole('button', { name: /add event/i }))
  expect(props.onAddEvent).toHaveBeenCalled()
})

test('export reports whether images should be embedded', async () => {
  const props = renderBar()
  await userEvent.click(screen.getByLabelText(/include images/i))
  await userEvent.click(screen.getByRole('button', { name: /^export$/i }))
  expect(props.onExport).toHaveBeenCalledWith({ includeImages: true })
})

test('choosing a file reports it for import', async () => {
  const props = renderBar()
  const file = new File(['{}'], 'tracker.json', { type: 'application/json' })
  await userEvent.upload(screen.getByLabelText(/import/i), file)
  expect(props.onImport).toHaveBeenCalledWith(file)
})

test('jump to now reports the request', async () => {
  const props = renderBar()
  await userEvent.click(screen.getByRole('button', { name: /now/i }))
  expect(props.onJumpToNow).toHaveBeenCalled()
})

test('export without touching the toggle reports includeImages false', async () => {
  const props = renderBar()
  await userEvent.click(screen.getByRole('button', { name: /^export$/i }))
  expect(props.onExport).toHaveBeenCalledWith({ includeImages: false })
})

test('the add-track and new-project buttons report their requests', async () => {
  const props = renderBar()
  await userEvent.click(screen.getByRole('button', { name: /add track/i }))
  await userEvent.click(screen.getByRole('button', { name: /new project/i }))
  expect(props.onAddTrack).toHaveBeenCalledTimes(1)
  expect(props.onCreate).toHaveBeenCalledTimes(1)
})
