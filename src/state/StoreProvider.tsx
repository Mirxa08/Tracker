import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react'
import { createProject } from '../domain/project'
import type { Project } from '../domain/schema'
import { listProjects, putProject, StorageError } from '../persistence/db'
import { currentProject, initialState, reducer, type Action, type State } from './reducer'

type Store = { state: State; dispatch: (action: Action) => void }

const StoreContext = createContext<Store | null>(null)

const SAVE_DEBOUNCE_MS = 300

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        const message = error instanceof StorageError
          ? error.message
          : 'Stored projects could not be opened.'
        dispatch({ type: 'error', message })
      })
    return () => { cancelled = true }
  }, [])

  // Writes are debounced so dragging a bar does not hammer IndexedDB. A pending write is
  // flushed on unmount rather than dropped, so the user's most recent edit is never lost.
  const project = currentProject(state)
  const pending = useRef<Project | null>(null)
  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const next = pending.current
    if (!next) return
    pending.current = null
    putProject(next).catch((error: unknown) => {
      const message = error instanceof StorageError ? error.message : 'Saving failed.'
      dispatch({ type: 'error', message })
    })
  }, [])

  useEffect(() => {
    if (!project) return
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
