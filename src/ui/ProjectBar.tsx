import { useRef, useState } from 'react'
import type { Project, Theme } from '../domain/schema'
import { Button, Field, Input, Segmented, Select, SpotlightSurface } from './sakuga'
import '../styles/project-bar.css'

const THEMES: readonly { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
]

export function ProjectBar({
  projects,
  currentId,
  theme,
  onSelect,
  onCreate,
  onAddTrack,
  onAddEvent,
  onImport,
  onExport,
  onJumpToNow,
  onChangeTheme,
}: {
  projects: Project[]
  currentId: string | null
  theme: Theme
  onSelect: (id: string) => void
  onCreate: () => void
  onAddTrack: () => void
  onAddEvent: () => void
  onImport: (file: File) => void
  onExport: (opts: { includeImages: boolean }) => void
  onJumpToNow: () => void
  onChangeTheme: (theme: Theme) => void
}) {
  const [includeImages, setIncludeImages] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  return (
    <SpotlightSurface as="header" className="project-bar" grid>
      <Field label="Project" className="project-bar__project">
        {(control) => (
          <Select
            {...control}
            value={currentId ?? ''}
            onChange={(e) => onSelect(e.target.value)}
          >
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
      </Field>

      <div className="project-bar__actions">
        <Button onClick={onCreate}>New project</Button>
        <Button onClick={onAddTrack}>Add track</Button>
        <Button variant="primary" onClick={onAddEvent}>Add event</Button>
        <Button onClick={onJumpToNow}>Now</Button>
      </div>

      <label className="project-bar__images">
        <input
          type="checkbox"
          checked={includeImages}
          onChange={(e) => setIncludeImages(e.target.checked)}
        />
        Include images
      </label>
      <Button onClick={() => onExport({ includeImages })}>Export</Button>

      <Field label="Import" className="project-bar__import">
        {(control) => (
          <Input
            {...control}
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onImport(file)
              if (fileInput.current) fileInput.current.value = ''
            }}
          />
        )}
      </Field>

      {/* A light theme has always been in the schema; this is the only way to reach it
          without changing the operating system's own setting. */}
      <Segmented
        className="project-bar__theme"
        label="Theme"
        value={theme}
        options={THEMES}
        onChange={onChangeTheme}
      />
    </SpotlightSurface>
  )
}
