import { useRef } from 'react'
import {
  addTrack, createProject, renameTrack, setTheme, setTrackCollapsed, updateEvent,
} from './domain/project'
import { buildExport, exportFileName, importFromJson, serializeExport } from './persistence/transfer'
import { StoreProvider, useStore } from './state/StoreProvider'
import { currentProject } from './state/reducer'
import { EventDetail } from './ui/EventDetail'
import { EventDialog, applyDraft } from './ui/EventDialog'
import { downloadText } from './ui/download'
import { ProjectBar } from './ui/ProjectBar'
import { Timeline, type TimelineHandle } from './ui/Timeline'
import { useAppliedTheme } from './ui/useTheme'
import { Button } from './ui/sakuga'
import './styles/theme.css'
import './styles/app.css'

function Workspace() {
  const { state, dispatch } = useStore()
  const project = currentProject(state)
  const selected = project?.events.find((e) => e.id === state.selectedEventId) ?? null
  const timeline = useRef<TimelineHandle>(null)
  // Before the first project loads there is nothing to read a setting from, and dark is the
  // default, so that is what the document carries until one arrives.
  const theme = project?.settings.theme ?? 'dark'
  useAppliedTheme(theme)
  const fail = (error: unknown, fallback: string) =>
    dispatch({ type: 'error', message: error instanceof Error ? error.message : fallback })

  // The provider persists whatever lands in state, so these only dispatch.
  const create = () => {
    const created = createProject('New project')
    dispatch({ type: 'loaded', projects: [...state.projects, created], currentId: created.id })
  }
  const addTrackPrompt = () => {
    if (!project) return
    const name = window.prompt('Track name')?.trim()
    if (!name) return
    dispatch({ type: 'applyProject', project: addTrack(project, name) })
  }
  const exportProject = async (opts: { includeImages: boolean }) => {
    if (!project) return
    try {
      const file = await buildExport(project, opts)
      downloadText(exportFileName(project, new Date()), serializeExport(file))
    } catch (error) {
      fail(error, 'That project could not be exported.')
    }
  }
  const importFile = async (file: File) => {
    try {
      const imported = await importFromJson(await file.text())
      dispatch({ type: 'error', message: null })
      dispatch({ type: 'loaded', projects: [...state.projects, imported], currentId: imported.id })
    } catch (error) {
      fail(error, 'That file could not be imported.')
    }
  }
  const deleteCurrent = () => {
    if (!project) return
    if (!window.confirm(`Delete "${project.name}" and everything in it? This cannot be undone.`)) return
    if (state.projects.length === 1) {
      // Never leave the app with no project: the provider only seeds one on first load.
      const fresh = createProject('My Timeline')
      dispatch({ type: 'loaded', projects: [fresh], currentId: fresh.id })
      return
    }
    dispatch({ type: 'removeProject', projectId: project.id })
  }

  return (
    <>
      <div className="app__masthead">
        <h1 className="app__title">Tracker</h1>
        {project && (
          <Button variant="danger" onClick={deleteCurrent}>Delete project</Button>
        )}
      </div>
      <ProjectBar
        projects={state.projects}
        currentId={state.currentId}
        theme={theme}
        onChangeTheme={(next) => {
          if (project) dispatch({ type: 'applyProject', project: setTheme(project, next) })
        }}
        onSelect={(projectId) => dispatch({ type: 'selectProject', projectId })}
        onCreate={create}
        onAddTrack={addTrackPrompt}
        onAddEvent={() => dispatch({ type: 'openAdd' })}
        onImport={importFile}
        onExport={exportProject}
        onJumpToNow={() => timeline.current?.scrollToNow()}
      />
      {state.error && <p className="app__alert" role="alert">{state.error}</p>}
      {state.undo && (
        <p className="app__status" role="status">
          {state.undo.label}
          <Button onClick={() => dispatch({ type: 'undo' })}>Undo</Button>
        </p>
      )}
      {project
        ? (
          <Timeline
            ref={timeline}
            project={project}
            onAddToTrack={(trackId) => dispatch({ type: 'openAdd', trackId })}
            onSelectEvent={(eventId) => dispatch({ type: 'selectEvent', eventId })}
            onToggleCollapse={(trackId, collapsed) => {
              dispatch({ type: 'applyProject', project: setTrackCollapsed(project, trackId, collapsed) })
            }}
            onRenameTrack={(trackId, name) => {
              dispatch({ type: 'applyProject', project: renameTrack(project, trackId, name) })
            }}
            onChangeDates={(eventId, dates) => {
              try {
                dispatch({ type: 'applyProject', project: updateEvent(project, eventId, dates) })
              } catch (error) {
                dispatch({ type: 'error', message: error instanceof Error ? error.message : 'That event could not be moved.' })
              }
            }}
          />
        )
        : <p className="app__loading">Loading…</p>}
      {selected && !state.dialog && (
        <EventDetail
          event={selected}
          onEdit={(eventId) => dispatch({ type: 'openEdit', eventId })}
          onDelete={(eventId) => dispatch({ type: 'deleteEvent', eventId })}
          onClose={() => dispatch({ type: 'selectEvent', eventId: null })}
        />
      )}
      {state.dialog && project && (
        <EventDialog
          project={project}
          dialog={state.dialog}
          onClose={() => dispatch({ type: 'closeDialog' })}
          onSubmit={(draft) => {
            try {
              dispatch({ type: 'applyProject', project: applyDraft(project, draft) })
              dispatch({ type: 'closeDialog' })
            } catch (error) {
              dispatch({ type: 'error', message: error instanceof Error ? error.message : 'That event could not be saved.' })
            }
          }}
        />
      )}
    </>
  )
}

export function App() {
  return (
    <StoreProvider>
      <Workspace />
    </StoreProvider>
  )
}
