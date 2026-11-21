import { useRef, useState } from 'react'
import type { Project } from '../domain/schema'
import { Button, Field, Input, Select, SpotlightSurface } from './sakuga'
import '../styles/project-bar.css'

export function ProjectBar({
  projects,
  currentId,
  onSelect,
  onCreate,
  onAddTrack,
  onAddEvent,
  onImport,
  onExport,
  onJumpToNow,
}: {
  projects: Project[]
  currentId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onAddTrack: () => void
  onAddEvent: () => void
  onImport: (file: File) => void
  onExport: (opts: { includeImages: boolean }) => void
  onJumpToNow: () => void
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
    </SpotlightSurface>
  )
}
