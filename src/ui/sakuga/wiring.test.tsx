import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App } from '../../App'
import { addTrack, createProject } from '../../domain/project'
import { DAY_WIDTH } from '../../domain/time'
import type { TrackEvent } from '../../domain/schema'
import { deleteProject, listProjects, setFlag } from '../../persistence/db'
import { EventBar } from '../EventBar'
import { ProjectBar } from '../ProjectBar'
import { Button, Field, IconButton, Input } from './index'
import type { SakugaCore } from './fx'

/**
 * The wiring, asserted.
 *
 * Every other test file in this project runs with `window.SakugaFX` absent, which is what
 * keeps them green — and it also means the whole effects layer could be deleted from the
 * components without a single one of them noticing. This file installs a stub core and
 * drives the real controls, so "which control fires which effect" is a property the suite
 * holds rather than a claim in a commit message.
 *
 * fireEvent.click throughout, not userEvent: userEvent sends a pointerdown, which starts
 * the squash's requestAnimationFrame loop and leaves it running past the end of the test.
 * The squash itself is covered in fx.test.ts.
 */

let fired: string[] = []

function installCore() {
  fired = []
  const note = (name: string) => () => { fired.push(name) }
  const fx = {
    calm: false,
    at: () => ({ x: 100, y: 100, w: 80, h: 24 }),
    squashy: () => ({ step: () => {} }),
    puff: note('puff'),
    burst: note('burst'),
    shards: note('shards'),
    ring: note('ring'),
    slash: note('slash'),
    lines: note('lines'),
    ticks: note('ticks'),
    kira: note('kira'),
    sfx: (word: string) => { fired.push(`sfx:${word}`) },
    hollow: () => ({ col: '#ffffff', edge: '#1d1a4a' }),
    // The real core's palette object, which the theme retints in place; the colours are
    // not what this file is about, but a stub without it is not a core.
    P: {
      fill: '#ffffff',
      shade: '#b8b3ff',
      line: '#5a4fd8',
      accent: '#ff5fa8',
      ink: '#1d1a4a',
      sfx: ['#1d1a4a', '#ffffff'] as [string, string],
    },
  }
  vi.stubGlobal('SakugaFX', fx as unknown as SakugaCore)
}

beforeEach(installCore)
afterEach(() => { vi.unstubAllGlobals() })

/**
 * Render the whole app on an EMPTY project. The two tests below drive it end to end, and
 * both start from "nothing on the timeline yet" — so they say so, rather than inheriting
 * whatever first run does (it seeds an example project full of bars, which would both hide
 * the "No tracks yet" signal they wait on and add bars neither test put there). Storage is
 * also cleared, because these two share one fake-indexeddb and the first one's seed would
 * otherwise be the second one's starting state.
 */
async function coldStart() {
  for (const p of await listProjects()) await deleteProject(p.id)
  await setFlag('exampleOffered', true)
  return render(<App />)
}

/** Everything the controls fired, with the lettering kept: that is half the point. */
const effects = () => fired

// --------------------------------------------------------------------- the toolbar -------

function toolbar() {
  const project = addTrack(createProject('Wuthering Waves'), 'Banners')
  render(
    <ProjectBar
      projects={[project]}
      currentId={project.id}
      theme="dark"
      onSelect={() => {}}
      onCreate={() => {}}
      onAddTrack={() => {}}
      onAddEvent={() => {}}
      onImport={() => {}}
      onExport={() => {}}
      onJumpToNow={() => {}}
      onChangeTheme={() => {}}
    />,
  )
}

test.each([
  ['New project'],
  ['Add track'],
  ['Add event'],
  ['Now'],
  ['Export'],
])('%s lands the impact frame: the burst and the ドン lettering', (name) => {
  toolbar()
  fireEvent.click(screen.getByRole('button', { name }))
  expect(effects()).toEqual(['burst', 'sfx:don'])
})

test('the Include images checkbox slashes, throws crystals and letters ズザッ', () => {
  toolbar()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include images' }))
  expect(effects()).toEqual(['slash', 'shards', 'sfx:zuza'])
})

test('choosing a theme fans ticks and letters a hollow ポン on the option taken', () => {
  toolbar()
  fireEvent.click(screen.getByRole('radio', { name: 'Light' }))
  expect(effects()).toEqual(['ticks', 'sfx:pon'])
})

// ----------------------------------------------------------------- the weights ----------

test('a quiet button puffs and ticks, and never letters', () => {
  render(<Button>Cancel</Button>)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(effects()).toEqual(['puff', 'ticks'])
})

test('a danger button shatters: crystals and ズザッ', () => {
  render(<Button variant="danger">Delete track</Button>)
  fireEvent.click(screen.getByRole('button', { name: 'Delete track' }))
  expect(effects()).toEqual(['shards', 'sfx:zuza'])
})

test('the undo weight is a hollow カチ alone', () => {
  render(<Button fx="clack">Undo</Button>)
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  expect(effects()).toEqual(['sfx:kachi'])
})

test('an icon button stays quiet: there are five of them in every gutter row', () => {
  render(<IconButton label="Delete Banners">&times;</IconButton>)
  fireEvent.click(screen.getByRole('button', { name: 'Delete Banners' }))
  expect(effects()).toEqual(['puff', 'ticks'])
  expect(effects().some((e) => e.startsWith('sfx'))).toBe(false)
})

test('a button still calls its own handler, and the effect fires before it', () => {
  const onClick = vi.fn(() => { fired.push('handler') })
  render(<Button variant="primary" onClick={onClick}>Save</Button>)
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(onClick).toHaveBeenCalledTimes(1)
  // Before: a handler that unmounts the button would leave no box to measure.
  expect(effects()).toEqual(['burst', 'sfx:don', 'handler'])
})

test('a button asked for no effect gets none, and still works', () => {
  const onClick = vi.fn()
  render(<Button fx="none" onClick={onClick}>Silent</Button>)
  fireEvent.click(screen.getByRole('button', { name: 'Silent' }))
  expect(onClick).toHaveBeenCalledTimes(1)
  expect(effects()).toEqual([])
})

// -------------------------------------------------------------------- typing -------------

test('typing in a text field kicks up dust, and the field still reports the keystroke', () => {
  const onKeyDown = vi.fn()
  render(<Field label="Event name">{(p) => <Input {...p} onKeyDown={onKeyDown} />}</Field>)
  fireEvent.keyDown(screen.getByLabelText('Event name'), { key: 'L' })
  expect(effects()).toEqual(['puff'])
  expect(onKeyDown).toHaveBeenCalledTimes(1)
})

test('a key that moves around the field without changing it raises no dust', () => {
  render(<Field label="Event name">{(p) => <Input {...p} />}</Field>)
  for (const key of ['Tab', 'Escape', 'ArrowLeft', 'Shift', 'Enter']) {
    fireEvent.keyDown(screen.getByLabelText('Event name'), { key })
  }
  expect(effects()).toEqual([])
})

test('a field with no caret to puff from — a colour or a file — raises no dust', () => {
  render(
    <>
      <Field label="Colour">{(p) => <Input {...p} type="color" />}</Field>
      <Field label="Image">{(p) => <Input {...p} type="file" />}</Field>
    </>,
  )
  fireEvent.keyDown(screen.getByLabelText('Colour'), { key: 'a' })
  fireEvent.keyDown(screen.getByLabelText('Image'), { key: 'a' })
  expect(effects()).toEqual([])
})

// ------------------------------------------------------------------ the bars -------------

const event: TrackEvent = {
  id: 'e_1',
  trackId: 't_1',
  name: 'Lily Banner',
  start: new Date(2026, 10, 5).toISOString(),
  end: new Date(2026, 10, 26).toISOString(),
  color: '#7a5cff',
}

function bar(justCreated = false) {
  render(
    <EventBar
      event={event}
      viewStart={new Date(2026, 10, 1)}
      now={new Date(2026, 10, 10)}
      justCreated={justCreated}
      onSelect={() => {}}
      onChangeDates={() => {}}
    />,
  )
  return screen.getByRole('button', { name: /Lily Banner/ })
}

test('a bar that was just created bursts in with a sparkle', () => {
  bar(true)
  expect(effects()).toEqual(['burst', 'kira'])
})

test('a bar that was already there does not', () => {
  bar(false)
  expect(effects()).toEqual([])
})

test('dragging a bar trails speed lines and setting it down rings', () => {
  const target = bar()
  fireEvent.pointerDown(target, { clientX: 100, pointerId: 1, button: 0 })
  fireEvent.pointerMove(target, { clientX: 100 + 3 * DAY_WIDTH, pointerId: 1 })
  expect(effects()).toEqual(['lines'])
  fireEvent.pointerUp(target, { clientX: 100 + 3 * DAY_WIDTH, pointerId: 1 })
  expect(effects()).toEqual(['lines', 'ring', 'puff'])
})

test('a click that never became a drag neither trails nor rings', () => {
  const target = bar()
  fireEvent.pointerDown(target, { clientX: 100, pointerId: 1, button: 0 })
  fireEvent.pointerUp(target, { clientX: 100, pointerId: 1 })
  expect(effects()).toEqual([])
})

// ------------------------------------------------------------------ the alert ------------

test('a failure cracks: crystals and no lettering, because an error is not a celebration', async () => {
  await coldStart()
  // The provider seeds and loads before the toolbar appears.
  const field = await screen.findByLabelText('Import')
  fired = []
  const bad = new File(['this is not json'], 'broken.json', { type: 'application/json' })
  fireEvent.change(field, { target: { files: [bad] } })
  await screen.findByRole('alert')
  // Choosing the file is one of the toolbar's real actions, so it lands its own impact
  // frame first. What matters here is what the FAILURE added after it.
  expect(effects().slice(0, 2)).toEqual(['burst', 'sfx:don'])
  expect(effects().slice(2)).toEqual(['shards'])
})

// ------------------------------------------------------- the bar a Save creates ----------

test('an event created through the dialog bursts in, and editing one does not', async () => {
  await coldStart()
  const timeline = await screen.findByText(/No tracks yet/)
  expect(timeline).toBeInTheDocument()

  // A track to put it on.
  fireEvent.click(screen.getByRole('button', { name: 'New track' }))
  fireEvent.change(screen.getByLabelText('Track name'), { target: { value: 'Banners' } })
  fireEvent.keyDown(screen.getByLabelText('Track name'), { key: 'Enter' })

  fireEvent.click(screen.getByRole('button', { name: 'Add event' }))
  fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Lily Banner' } })
  fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-11-05T08:00' } })
  fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-11-26T08:00' } })
  fired = []
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  const bar = await screen.findByRole('button', { name: /Lily Banner/ })
  // Save's own impact frame, then the new bar arriving.
  expect(effects()).toEqual(['burst', 'sfx:don', 'burst', 'kira'])

  // Editing it is not a creation: the bar is already there and must not burst again.
  fireEvent.click(bar)
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Lily Banner II' } })
  fired = []
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByRole('button', { name: /Lily Banner II/ })
  expect(effects()).toEqual(['burst', 'sfx:don'])
})
