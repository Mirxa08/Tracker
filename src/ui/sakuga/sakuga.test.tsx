import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import css from '../../styles/sakuga.css?raw'
import { Badge, Button, Field, IconButton, Input, Panel, Segmented, Select, SpotlightSurface } from './index'

// --------------------------------------------------------------------- SpotlightSurface ----

test('SpotlightSurface renders the surface, and the grid only when asked', () => {
  const { rerender } = render(<SpotlightSurface data-testid="s">content</SpotlightSurface>)
  const surface = screen.getByTestId('s')
  expect(surface).toHaveClass('sk-spotlight')
  expect(surface).not.toHaveClass('sk-spotlight--grid')
  expect(surface).toHaveTextContent('content')
  rerender(<SpotlightSurface data-testid="s" grid className="extra">content</SpotlightSurface>)
  expect(screen.getByTestId('s')).toHaveClass('sk-spotlight', 'sk-spotlight--grid', 'extra')
})

test('SpotlightSurface writes the cursor position, relative to its own box, as custom properties', async () => {
  render(<SpotlightSurface data-testid="s" as="section">content</SpotlightSurface>)
  const surface = screen.getByTestId('s')
  expect(surface.tagName).toBe('SECTION')
  // jsdom reports a zero rect for everything, so the element is given an origin away from
  // the viewport's: without that, a reading that forgot to subtract it would still pass.
  surface.getBoundingClientRect = () => ({ left: 10, top: 5, width: 100, height: 40 }) as DOMRect
  expect(surface.style.getPropertyValue('--mouse-x')).toBe('')
  await userEvent.pointer({ target: surface, coords: { clientX: 42, clientY: 17 } })
  expect(surface.style.getPropertyValue('--mouse-x')).toBe('32px')
  expect(surface.style.getPropertyValue('--mouse-y')).toBe('12px')
})

test('the spotlight is Sakuga UI\'s: two cursor properties, an inner glow and a masked border glow', () => {
  // Credit, per the kit's licence.
  expect(css).toContain('https://github.com/prateekraiger/sakuga-ui')
  expect(css).toMatch(/Prateek Raiger/)
  expect(css).toMatch(/MIT/)
  // The technique itself: the two radii and alphas are the ones SpotlightGrid paints with.
  expect(css).toMatch(/800px circle at var\(--mouse-x[^)]*\) var\(--mouse-y[^)]*\),\s*rgba\(255, 255, 255, 0\.06\),\s*transparent 40%/)
  expect(css).toMatch(/600px circle at var\(--mouse-x[^)]*\) var\(--mouse-y[^)]*\),\s*rgba\(255, 255, 255, 0\.4\),\s*transparent 40%/)
  // The border glow is masked to the 1px edge, or it floods the whole surface.
  expect(css).toMatch(/mask-composite:\s*exclude/)
  // The grid texture, at Sakuga's 20px pitch.
  expect(css).toMatch(/background-size:\s*20px 20px/)
})

test('reduced motion drops the transforms and the glow transitions', () => {
  const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*)\}\s*$/.exec(css)
  expect(block).not.toBeNull()
  expect(block![1]).toMatch(/transition:\s*none/)
  expect(block![1]).toMatch(/transform:\s*none/)
  // The rules that animate must be the rules the block switches off.
  for (const selector of ['.sk-spotlight::before', '.sk-btn', '.sk-icon-btn', '.sk-seg__label']) {
    expect(block![1]).toContain(selector)
  }
})

// ------------------------------------------------------------------------------ Button ----

test('Button variants differ, and a plain Button never submits its form', async () => {
  const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
  const onClick = vi.fn()
  render(
    <form onSubmit={onSubmit}>
      <Button variant="primary" onClick={onClick}>Save</Button>
      <Button variant="quiet">Cancel</Button>
      <Button variant="danger">Delete</Button>
    </form>,
  )
  const primary = screen.getByRole('button', { name: 'Save' })
  expect(primary).toHaveClass('sk-btn', 'sk-btn--primary')
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('sk-btn--quiet')
  expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('sk-btn--danger')
  expect(primary).not.toHaveClass('sk-btn--quiet')

  await userEvent.tab()
  expect(primary).toHaveFocus()
  await userEvent.keyboard('{Enter}')
  expect(onClick).toHaveBeenCalledTimes(1)
  expect(onSubmit).not.toHaveBeenCalled()
})

test('Button declares the hover and active scales over the fast duration', () => {
  expect(css).toMatch(/\.sk-btn:hover\s*\{\s*transform:\s*scale\(1\.02\)/)
  expect(css).toMatch(/\.sk-btn:active\s*\{\s*transform:\s*scale\(0\.98\)/)
  expect(css).toMatch(/\.sk-btn\s*\{[^}]*transition:[^;]*var\(--t-fast\)/)
})

// -------------------------------------------------------------------------- IconButton ----

test('IconButton names itself from its label, not its glyph, and is operable by keyboard', async () => {
  const onClick = vi.fn()
  render(<IconButton label="Close details" onClick={onClick}>&times;</IconButton>)
  const button = screen.getByRole('button', { name: 'Close details' })
  expect(button).toHaveClass('sk-icon-btn')
  await userEvent.tab()
  expect(button).toHaveFocus()
  await userEvent.keyboard('{Enter}')
  await userEvent.keyboard(' ')
  expect(onClick).toHaveBeenCalledTimes(2)
})

// ------------------------------------------------------------------- Field / Input --------

test('Field ties its label to the control it wraps, for all three control kinds', () => {
  render(
    <>
      <Field label="Event name">{(p) => <Input {...p} defaultValue="Lily" />}</Field>
      <Field label="Start">{(p) => <Input {...p} type="datetime-local" />}</Field>
      <Field label="Track">
        {(p) => <Select {...p}><option value="t1">Banners</option></Select>}
      </Field>
    </>,
  )
  expect(screen.getByLabelText('Event name')).toHaveValue('Lily')
  expect(screen.getByLabelText('Start')).toHaveAttribute('type', 'datetime-local')
  expect(screen.getByLabelText('Track').tagName).toBe('SELECT')
  // One finish for all three.
  expect(screen.getByLabelText('Event name')).toHaveClass('sk-input')
  expect(screen.getByLabelText('Start')).toHaveClass('sk-input')
  expect(screen.getByLabelText('Track')).toHaveClass('sk-select')
})

test('a Field error is announced through the control, not just painted next to it', () => {
  const { rerender } = render(<Field label="Event name">{(p) => <Input {...p} />}</Field>)
  const control = screen.getByLabelText('Event name')
  expect(control).not.toHaveAttribute('aria-invalid')
  expect(control).not.toHaveAttribute('aria-describedby')

  rerender(<Field label="Event name" error="Give the event a name.">{(p) => <Input {...p} />}</Field>)
  const invalid = screen.getByLabelText('Event name')
  expect(invalid).toHaveAttribute('aria-invalid', 'true')
  const describedBy = invalid.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  expect(document.getElementById(describedBy!)).toHaveTextContent('Give the event a name.')
})

test('every control declares a focus ring, so neither theme can lose it', () => {
  const ring = /\.sk-input:focus-visible[\s\S]*?\{([^}]*)\}/.exec(css)
  expect(ring).not.toBeNull()
  expect(ring![1]).toMatch(/outline:\s*2px solid var\(--fg\)/)
  expect(ring![1]).toMatch(/outline-offset/)
  for (const selector of ['.sk-btn:focus-visible', '.sk-icon-btn:focus-visible', '.sk-select:focus-visible', '.sk-seg__input:focus-visible + .sk-seg__label']) {
    expect(css).toContain(selector)
  }
})

// ------------------------------------------------------------------------------ Select ----

test('Select is a native select, keyboard-selectable, with the shared finish', async () => {
  const onChange = vi.fn()
  render(
    <Field label="Track">
      {(p) => (
        <Select {...p} defaultValue="t1" onChange={(e) => onChange(e.target.value)}>
          <option value="t1">Banners</option>
          <option value="t2">Combat</option>
        </Select>
      )}
    </Field>,
  )
  const select = screen.getByLabelText('Track')
  expect(select.tagName).toBe('SELECT')
  await userEvent.selectOptions(select, 't2')
  expect(onChange).toHaveBeenCalledWith('t2')
})

// ------------------------------------------------------------------------------- Badge ----

test('Badge is a monospace pill with a blurred backdrop', () => {
  render(<Badge data-testid="b">12d 4h</Badge>)
  expect(screen.getByTestId('b')).toHaveClass('sk-badge')
  const block = /\.sk-badge\s*\{([^}]*)\}/.exec(css)
  expect(block).not.toBeNull()
  expect(block![1]).toMatch(/border-radius:\s*var\(--r-pill\)/)
  expect(block![1]).toMatch(/font-family:[^;]*monospace/)
  expect(block![1]).toMatch(/backdrop-filter:\s*blur/)
})

// ------------------------------------------------------------------------------- Panel ----

test('Panel renders the requested tag with the large radius and keeps the caller\'s class', () => {
  const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
  render(<Panel as="form" className="dialog" data-testid="p" onSubmit={onSubmit}><button type="submit">Save</button></Panel>)
  const panel = screen.getByTestId('p')
  expect(panel.tagName).toBe('FORM')
  expect(panel).toHaveClass('sk-panel', 'sk-spotlight', 'dialog')
  expect(/\.sk-panel\s*\{([^}]*)\}/.exec(css)![1]).toMatch(/border-radius:\s*var\(--r-lg\)/)
  screen.getByRole('button', { name: 'Save' }).click()
  expect(onSubmit).toHaveBeenCalled()
})

// --------------------------------------------------------------------------- Segmented ----

function ThemeSwitch() {
  const [value, setValue] = useState<'dark' | 'light' | 'system'>('dark')
  return (
    <Segmented
      label="Theme"
      value={value}
      onChange={setValue}
      options={[
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' },
        { value: 'system', label: 'System' },
      ]}
    />
  )
}

test('Segmented is a radio group: labelled, keyboard-operable, one option checked', async () => {
  render(<ThemeSwitch />)
  const group = screen.getByRole('radiogroup', { name: 'Theme' })
  expect(group).toHaveClass('sk-seg')
  const dark = screen.getByRole('radio', { name: 'Dark' })
  const light = screen.getByRole('radio', { name: 'Light' })
  expect(dark).toBeChecked()
  expect(light).not.toBeChecked()

  // One shared name, or the browser treats each option as its own group: tab would stop at
  // every option and the arrow keys would not move between them. (userEvent emulates the
  // arrow-key move itself, so the assertion below cannot stand in for this one.)
  const names = screen.getAllByRole('radio').map((r) => r.getAttribute('name'))
  expect(names[0]).toBeTruthy()
  expect(new Set(names).size).toBe(1)

  // Tab reaches the checked radio; the arrow keys move within the group, as a radio group must.
  await userEvent.tab()
  expect(dark).toHaveFocus()
  await userEvent.keyboard('{ArrowRight}')
  expect(light).toBeChecked()
  expect(dark).not.toBeChecked()
  expect(screen.getByRole('radio', { name: 'System' })).not.toBeChecked()
})

test('Segmented paints the checked option differently from the rest', () => {
  expect(css).toMatch(/\.sk-seg__input:checked \+ \.sk-seg__label\s*\{[^}]*color:\s*var\(--fg\)/)
  expect(/\.sk-seg__label\s*\{([^}]*)\}/.exec(css)![1]).toMatch(/color:\s*var\(--muted\)/)
})
