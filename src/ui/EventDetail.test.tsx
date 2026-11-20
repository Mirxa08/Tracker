import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TrackEvent } from '../domain/schema'
import { EventDetail } from './EventDetail'

const event: TrackEvent = {
  id: 'e_1', trackId: 't_1', name: 'Lily Banner',
  start: new Date(2026, 10, 5).toISOString(),
  end: new Date(2026, 10, 26).toISOString(),
  color: '#7a5cff',
  notes: { columns: ['Resource', 'Left'], rows: [['Astrite', '12000']] },
}

test('shows the event name and its notes table', () => {
  render(<EventDetail event={event} onEdit={() => {}} onDelete={() => {}} onClose={() => {}} />)
  expect(screen.getByRole('heading', { name: 'Lily Banner' })).toBeInTheDocument()
  expect(screen.getByText('Astrite')).toBeInTheDocument()
  expect(screen.getByText('12000')).toBeInTheDocument()
})

test('says so when there are no notes', () => {
  const { notes, ...bare } = event
  render(<EventDetail event={bare} onEdit={() => {}} onDelete={() => {}} onClose={() => {}} />)
  expect(screen.getByText(/no notes/i)).toBeInTheDocument()
})

test('edit and delete call their handlers with the event id', async () => {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  render(<EventDetail event={event} onEdit={onEdit} onDelete={onDelete} onClose={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /edit/i }))
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onEdit).toHaveBeenCalledWith('e_1')
  expect(onDelete).toHaveBeenCalledWith('e_1')
})

test('the close button calls onClose', async () => {
  const onClose = vi.fn()
  render(<EventDetail event={event} onEdit={() => {}} onDelete={() => {}} onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: /close/i }))
  expect(onClose).toHaveBeenCalledTimes(1)
})
