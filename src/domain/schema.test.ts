import {
  SCHEMA_VERSION, ValidationError, validateProject, validateExportFile, migrate, newId,
} from './schema'

const project = {
  id: 'p_1',
  name: 'Wuthering Waves',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  tracks: [{ id: 't_1', name: 'Banners', color: '#7a5cff', order: 0, collapsed: false }],
  events: [{
    id: 'e_1', trackId: 't_1', name: 'Lily Banner',
    start: '2026-11-05T10:00:00.000Z', end: '2026-11-26T10:00:00.000Z',
    color: '#7a5cff',
  }],
  settings: { theme: 'dark' as const },
}

test('accepts a well-formed project', () => {
  expect(validateProject(project)).toEqual(project)
})

test('rejects a non-object', () => {
  expect(() => validateProject(null)).toThrow(ValidationError)
})

test('names the offending field when a required field is missing', () => {
  const { name, ...rest } = project
  try {
    validateProject(rest)
    throw new Error('should have thrown')
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).field).toBe('name')
  }
})

test('rejects an event whose end is not after its start', () => {
  const bad = { ...project, events: [{ ...project.events[0], end: project.events[0].start }] }
  expect(() => validateProject(bad)).toThrow(/after/i)
})

test('rejects an event referencing an unknown track', () => {
  const bad = { ...project, events: [{ ...project.events[0], trackId: 't_missing' }] }
  expect(() => validateProject(bad)).toThrow(/track/i)
})

test('rejects a notes table whose row length does not match its columns', () => {
  const bad = {
    ...project,
    events: [{ ...project.events[0], notes: { columns: ['A', 'B'], rows: [['only one']] } }],
  }
  expect(() => validateProject(bad)).toThrow(/notes/i)
})

test('accepts an export file at the current version', () => {
  const file = { schemaVersion: SCHEMA_VERSION, exportedAt: '2026-11-20T00:00:00.000Z', project, images: {} }
  expect(validateExportFile(file)).toEqual(file)
})

test('rejects an export file from a newer version rather than guessing', () => {
  const file = { schemaVersion: SCHEMA_VERSION + 1, exportedAt: '2026-11-20T00:00:00.000Z', project, images: {} }
  expect(() => validateExportFile(file)).toThrow(/newer version/i)
})

test('migrate returns a current-version file unchanged', () => {
  const file = { schemaVersion: SCHEMA_VERSION, exportedAt: '2026-11-20T00:00:00.000Z', project, images: {} }
  expect(migrate(file)).toEqual(file)
})

test('newId produces unique prefixed ids', () => {
  const a = newId('e')
  const b = newId('e')
  expect(a).toMatch(/^e_/)
  expect(a).not.toBe(b)
})
