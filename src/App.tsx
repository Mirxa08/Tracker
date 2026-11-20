import { StoreProvider, useStore } from './state/StoreProvider'
import { currentProject } from './state/reducer'
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
