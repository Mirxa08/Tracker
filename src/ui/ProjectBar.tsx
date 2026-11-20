import { useRef, useState } from 'react'
import type { Project } from '../domain/schema'
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
    <header className="project-bar">
      <label className="project-bar__project">
        Project
        <select value={currentId ?? ''} onChange={(e) => onSelect(e.target.value)}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <button type="button" onClick={onCreate}>New project</button>
      <button type="button" onClick={onAddTrack}>Add track</button>
      <button type="button" onClick={onAddEvent}>Add event</button>
      <button type="button" onClick={onJumpToNow}>Now</button>

      <label className="project-bar__images">
        <input
          type="checkbox"
          checked={includeImages}
          onChange={(e) => setIncludeImages(e.target.checked)}
        />
        Include images
      </label>
      <button type="button" onClick={() => onExport({ includeImages })}>Export</button>

      <label className="project-bar__import">
        Import
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImport(file)
            if (fileInput.current) fileInput.current.value = ''
          }}
        />
      </label>
    </header>
  )
}
