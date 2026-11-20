import { deleteEvent, deleteTrack } from '../domain/project'
import type { Project } from '../domain/schema'

export type DialogState =
  | { mode: 'add'; trackId?: string }
  | { mode: 'edit'; eventId: string }
  | null

export type UndoEntry = { label: string; project: Project } | null

export type State = {
  projects: Project[]
  currentId: string | null
  selectedEventId: string | null
  dialog: DialogState
  undo: UndoEntry
  error: string | null
}

export const initialState: State = {
  projects: [],
  currentId: null,
  selectedEventId: null,
  dialog: null,
  undo: null,
  error: null,
}

export type Action =
  | { type: 'loaded'; projects: Project[]; currentId: string | null }
  | { type: 'applyProject'; project: Project }
  | { type: 'selectProject'; projectId: string }
  | { type: 'removeProject'; projectId: string }
  | { type: 'deleteEvent'; eventId: string }
  | { type: 'deleteTrack'; trackId: string }
  | { type: 'undo' }
  | { type: 'openAdd'; trackId?: string }
  | { type: 'openEdit'; eventId: string }
  | { type: 'closeDialog' }
  | { type: 'selectEvent'; eventId: string | null }
  | { type: 'error'; message: string | null }

export function currentProject(state: State): Project | null {
  return state.projects.find((p) => p.id === state.currentId) ?? null
}

function replace(state: State, project: Project): State {
  return {
    ...state,
    projects: state.projects.map((p) => (p.id === project.id ? project : p)),
  }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded':
      return { ...state, projects: action.projects, currentId: action.currentId }

    case 'applyProject':
      return replace(state, action.project)

    case 'selectProject':
      return { ...state, currentId: action.projectId, selectedEventId: null, dialog: null }

    case 'removeProject': {
      const projects = state.projects.filter((p) => p.id !== action.projectId)
      const currentId = state.currentId === action.projectId
        ? (projects[0]?.id ?? null)
        : state.currentId
      return { ...state, projects, currentId, selectedEventId: null, dialog: null }
    }

    case 'deleteEvent': {
      const project = currentProject(state)
      if (!project) return state
      const event = project.events.find((e) => e.id === action.eventId)
      if (!event) return state
      return {
        ...replace(state, deleteEvent(project, action.eventId)),
        undo: { label: `Deleted "${event.name}"`, project },
        selectedEventId: null,
        dialog: null,
      }
    }

    case 'deleteTrack': {
      const project = currentProject(state)
      if (!project) return state
      const track = project.tracks.find((t) => t.id === action.trackId)
      if (!track) return state
      return {
        ...replace(state, deleteTrack(project, action.trackId)),
        undo: { label: `Deleted track "${track.name}"`, project },
        selectedEventId: null,
        dialog: null,
      }
    }

    case 'undo': {
      if (!state.undo) return state
      return { ...replace(state, state.undo.project), undo: null }
    }

    case 'openAdd':
      return { ...state, dialog: { mode: 'add', trackId: action.trackId } }

    case 'openEdit':
      return { ...state, dialog: { mode: 'edit', eventId: action.eventId } }

    case 'closeDialog':
      return { ...state, dialog: null }

    case 'selectEvent':
      return { ...state, selectedEventId: action.eventId }

    case 'error':
      return { ...state, error: action.message }
  }
}
