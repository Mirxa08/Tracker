import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react'
import { createProject } from '../domain/project'
import type { Project } from '../domain/schema'
import { deleteImage, deleteProject, listProjects, putProject, StorageError } from '../persistence/db'
import { currentProject, initialState, reducer, type Action, type State } from './reducer'

type Store = { state: State; dispatch: (action: Action) => void }

const StoreContext = createContext<Store | null>(null)

const SAVE_DEBOUNCE_MS = 300

function addImageIds(into: Set<string>, project: Project | null | undefined) {
  if (!project) return
  for (const event of project.events) if (event.imageId) into.add(event.imageId)
}

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

  // Image records live in one global store, keyed by image id alone, so a sweep scoped to a
  // single project would delete other projects' images. The sweep therefore keeps everything
  // referenced by ANY project in state (and by the pending undo), and it only ever deletes an
  // id this session has seen referenced and that nothing references any more. An image that
  // was never referenced (an upload still in an open dialog, an import in flight, another
  // tab's data) is never a candidate.
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state })
  const seenImages = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const p of state.projects) addImageIds(seenImages.current, p)
    addImageIds(seenImages.current, state.undo?.project)
  }, [state.projects, state.undo])

  // `written` is the project version that just reached storage: state can be ahead of disk,
  // so an image the stored copy still references is kept until a later write supersedes it.
  const sweepImages = useCallback((written: Project | null) => {
    if (!persistent.current) return
    const current = stateRef.current
    const keep = new Set<string>()
    for (const p of current.projects) addImageIds(keep, p)
    addImageIds(keep, current.undo?.project)
    addImageIds(keep, written)
    for (const id of [...seenImages.current]) {
      if (keep.has(id)) continue
      deleteImage(id).then(() => { seenImages.current.delete(id) }, () => {})
    }
  }, [])

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const next = pending.current
    pending.current = null
    if (!next || !persistent.current) return
    putProject(next).then(() => sweepImages(next), (error: unknown) => {
      const message = error instanceof StorageError ? error.message : 'Saving failed.'
      dispatch({ type: 'error', message })
    })
  }, [sweepImages])

  // Removed projects must not come back on the next load. A pending write for a removed
  // project is dropped first so it cannot resurrect the row.
  useEffect(() => {
    const current = new Set(state.projects.map((p) => p.id))
    for (const id of knownIds.current) {
      if (current.has(id)) continue
      if (pending.current?.id === id) pending.current = null
      if (persistent.current) {
        deleteProject(id).then(() => sweepImages(null), (error: unknown) => {
          const message = error instanceof StorageError ? error.message : 'Deleting failed.'
          dispatch({ type: 'error', message })
        })
      }
    }
    knownIds.current = current
  }, [state.projects, sweepImages])

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
