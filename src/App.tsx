import { StoreProvider, useStore } from './state/StoreProvider'
import { currentProject } from './state/reducer'
import { EventDialog, applyDraft } from './ui/EventDialog'
import { Timeline } from './ui/Timeline'
import './styles/theme.css'

function Workspace() {
  const { state, dispatch } = useStore()
  const project = currentProject(state)
  return (
    <>
      <h1>Tracker</h1>
      {state.error && <p role="alert">{state.error}</p>}
      {project
        ? <Timeline project={project} onAddToTrack={(trackId) => dispatch({ type: 'openAdd', trackId })} />
        : <p>Loading…</p>}
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
