import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react'
import { createProject } from '../domain/project'
import type { Project } from '../domain/schema'
import { deleteProject, listProjects, putProject, StorageError } from '../persistence/db'
import { currentProject, initialState, reducer, type Action, type State } from './reducer'

type Store = { state: State; dispatch: (action: Action) => void }

const StoreContext = createContext<Store | null>(null)

const SAVE_DEBOUNCE_MS = 300

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // False once storage has failed to open: the session runs in memory and never writes.
  const persistent = useRef(true)

  useEffect(() => {
    let cancelled = false
    listProjects()
      .then(async (projects) => {
        if (cancelled) return
        if (projects.length === 0) {
          const first = createProject('My Timeline')
          await putProject(first)
          dispatch({ type: 'loaded', projects: [first], currentId: first.id })
        } else {
          dispatch({ type: 'loaded', projects, currentId: projects[0].id })
        }
      })
      .catch((error: unknown) => {
        persistent.current = false
        const message = error instanceof StorageError
          ? error.message
          : 'Stored projects could not be opened.'
        dispatch({ type: 'error', message })
        // Keep the session usable for this visit; nothing it does will be saved.
        const session = createProject('My Timeline')
        dispatch({ type: 'loaded', projects: [session], currentId: session.id })
      })
    return () => { cancelled = true }
  }, [])

  // Writes are debounced so dragging a bar does not hammer IndexedDB. A pending write is
  // flushed on unmount or when the current project changes, never dropped.
  const project = currentProject(state)
  const pending = useRef<Project | null>(null)
  const knownIds = useRef<Set<string>>(new Set())

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const next = pending.current
    pending.current = null
    if (!next || !persistent.current) return
    putProject(next).catch((error: unknown) => {
      const message = error instanceof StorageError ? error.message : 'Saving failed.'
      dispatch({ type: 'error', message })
    })
  }, [])

  // Removed projects must not come back on the next load. A pending write for a removed
  // project is dropped first so it cannot resurrect the row.
  useEffect(() => {
    const current = new Set(state.projects.map((p) => p.id))
    for (const id of knownIds.current) {
      if (current.has(id)) continue
      if (pending.current?.id === id) pending.current = null
      if (persistent.current) {
        deleteProject(id).catch((error: unknown) => {
          const message = error instanceof StorageError ? error.message : 'Deleting failed.'
          dispatch({ type: 'error', message })
        })
      }
    }
    knownIds.current = current
  }, [state.projects])

  useEffect(() => {
    if (!project) return
    // Switching projects inside the debounce window must not lose the other project's edit.
    if (pending.current && pending.current.id !== project.id) flush()
    pending.current = project
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS)
  }, [project, flush])

  useEffect(() => flush, [flush])

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside a StoreProvider')
  return store
}
