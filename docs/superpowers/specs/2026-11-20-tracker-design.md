# Tracker — Design

Date: 2026-11-20
Status: Approved (pending implementation plan)

## Purpose

A small public site that lets a person build timeline trackers for whatever
they care about: game banner rotations, event windows, deadlines, seasons.

A timeline is called a **project**. A person may keep several projects and
switch between them. Everything lives in the person's own browser; the site
stores nothing on a server.

## Scope decisions

Four decisions were settled before design and constrain everything below.

**No accounts.** Google sign-in was in the original brief but was dropped. With
no backend there is no OAuth client to leak, no user data to breach, no privacy
policy to maintain, and the site works offline. Moving between devices is served
honestly by JSON export/import rather than by a sync that does not exist.

**Named tracks.** Rows are created and named by the person ("Character Banners",
"Weapon Banners", "Combat"), and events are added into a chosen track. Rows mean
something, so they can be renamed, reordered and collapsed. Events are not
auto-packed into anonymous rows.

**One day-wise scale.** A day per column, months as a header band, horizontal
scrolling through time. No zoom levels. Times are stored with minute precision
so bar edges and the now-line sit correctly within a day.

**Vite + React + TypeScript**, built and deployed to GitHub Pages by a GitHub
Action.

## Architecture

Four layers, each usable without reading the internals of the others.

```
  UI components  (timeline, dialogs, panels)
        |
  state store    (current project, selection, view window)
        |
  domain         (time<->pixel math, validation, schema, migration)
        |
  persistence    (IndexedDB: projects store, images store)
```

The domain layer is pure functions with no React and no browser storage. It is
where the arithmetic that is easy to get wrong lives, and it is tested directly.

### Modules

| Module | Responsibility | Depends on |
|---|---|---|
| `domain/time` | date↔pixel conversion, day columns, month grouping, remaining-time | nothing |
| `domain/schema` | project/track/event types, validation, `schemaVersion`, migration | nothing |
| `domain/project` | add/edit/delete track and event operations as pure transforms | `schema` |
| `persistence/db` | IndexedDB open, project CRUD, image blob CRUD, quota errors | `schema` |
| `persistence/transfer` | export to JSON file, import with validation + migration | `schema`, `db` |
| `state/store` | current project, selection, scroll window, undo of last delete | `domain`, `persistence` |
| `ui/Timeline` | header bands, track gutter, scroll body, now-line | `state`, `domain/time` |
| `ui/EventBar` | one event: label, image bleed, remaining badge, drag handles | `domain/time` |
| `ui/EventDialog` | add/edit form, image picker, notes table editor | `state` |
| `ui/ProjectBar` | project switcher, import/export, jump-to-now | `state`, `transfer` |

## Data model

```ts
type Project = {
  id: string
  name: string
  createdAt: string        // ISO
  updatedAt: string        // ISO
  tracks: Track[]
  events: Event[]
  settings: { theme: 'dark' | 'light' | 'system' }
}

type Track = {
  id: string
  name: string
  color: string            // hex, default assigned from a palette
  order: number
  collapsed: boolean
}

type Event = {
  id: string
  trackId: string
  name: string             // required
  start: string            // ISO, required
  end: string              // ISO, required, must be > start
  color: string            // hex, defaults to the track colour
  imageId?: string         // key into the images store
  notes?: Notes
}

type Notes = {
  columns: string[]        // person-defined, e.g. ["Resource", "Farmed", "Left"]
  rows: string[][]         // each row has columns.length cells
}
```

Times are ISO strings, not epoch numbers, so an exported file is readable and
diffable. Minute precision is kept even though display is day-wise.

Images are **not** stored inside the project record. They live in a separate
IndexedDB store as `Blob`s keyed by `imageId`, which keeps project reads cheap
and avoids base64 inflation in storage.

## Storage

IndexedDB, database `tracker`, two object stores:

- `projects` — keyed by `Project.id`, one record per project
- `images` — keyed by `imageId`, holding `{ id, blob, width, height }`

IndexedDB rather than `localStorage`: image blobs and multi-project data exceed
what a 5 MB string store handles comfortably, and structured values avoid
serialising the whole dataset on every keystroke.

Writes are debounced (300 ms) so dragging a bar does not hammer the database.

### Export and import

Export produces a single `.json` file:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-11-20T12:00:00.000Z",
  "project": { ... },
  "images": { "img_1": "data:image/webp;base64,..." }
}
```

A toggle controls whether images are embedded: off gives a small file for moving
structure around, on gives a complete backup. Events keep their `imageId` either
way; an import with missing images simply shows bars without images.

Import validates the payload against the schema before touching the database,
migrates older `schemaVersion` values forward, and reports the specific reason on
rejection rather than failing silently. Import never overwrites in place: it
creates a new project, so a bad file cannot destroy existing work.

## Layout and interaction

**Header bands.** A month band sits above a day band; both are sticky at the top
of the scroll container. Day cells show weekday initials over the date number.
Month labels stay pinned at the left edge of their visible span.

**Track gutter.** Track names sit in a sticky left column. A track can be
renamed inline, reordered by drag, and collapsed to hide its events.

**Scroll body.** Horizontally scrollable. Position maps time to pixels through
`domain/time`: `x = (t - viewStart) / MS_PER_DAY * DAY_WIDTH`, where `DAY_WIDTH` is a single
application constant — there are no zoom levels, so it is not per-project state.
The view window
extends one month either side of the earliest and latest event, expanding as
events are added.

**Now-line.** A vertical rule at the current instant with a time pill showing
`HH:MM:SS`, updated once a second. On load the view scrolls so the now-line is
roughly a third from the left. A "jump to now" control returns there.

**Event bars.** A bar spans its start to its end. The name is left-aligned in the
bar. An optional image is anchored to the bar's right edge and fades leftward
under a gradient mask, so it reads behind the text rather than fighting it. A
badge at the right edge shows **time remaining until the event ends**, counted
from now — `16d`, `1mo`, `5d` — and is omitted once the event has ended. Ended
events are dimmed; events not yet started are drawn at full strength with a
lighter fill.

Bars are dragged to move and edge-dragged to resize, snapping to day boundaries
by default and to the hour with a modifier held.

**Event detail.** Clicking a bar opens a panel showing the image at full size and
the notes table, with edit controls. The same form serves "add" and "edit".

**Add event.** The `+` control opens the dialog: name and start/end required;
track chosen from existing tracks or created inline; colour, image and notes
optional. The notes editor lets columns and rows be added freely, so a table of
"resources farmed / items left" is whatever the person defines.

**Images** are downscaled to at most 600px on the long edge and re-encoded to
WebP before storage, keeping the database small without visible loss at bar size.

**Theme.** Dark by default, matching the reference, with a light theme available
and `prefers-color-scheme` respected on first visit.

## Error handling

| Condition | Behaviour |
|---|---|
| `end` <= `start` | Dialog blocks submission, names the field |
| Empty name or missing dates | Dialog blocks submission, names the field |
| IndexedDB unavailable (private mode) | Banner explaining data will not persist; app still usable for the session |
| Quota exceeded on write | Explicit message naming images as the usual cause; the write is rolled back, not half-applied |
| Malformed import file | Rejected with the failing field and reason; existing data untouched |
| Unknown future `schemaVersion` | Rejected with a "made by a newer version" message rather than guessed at |
| Missing image referenced by an event | Bar renders without an image; no error |

Deleting a track or event is undoable for the remainder of the session, which is
cheaper than a confirmation dialog on every delete and more forgiving.

## Testing

Tests concentrate on the domain layer, where mistakes are silent.

- `domain/time`: date↔pixel round-trips, day-column generation across month and
  year boundaries, DST transitions, remaining-time formatting at the day/month
  thresholds
- `domain/schema`: validation accepts good payloads and rejects each malformed
  shape; migration from every past version produces a current-version project
- `domain/project`: add/edit/delete transforms, including deleting a track with
  events in it
- `persistence/transfer`: export→import round-trip preserves a project exactly,
  with and without embedded images
- `ui/EventDialog`: required-field validation, notes table add/remove column and
  row

Vitest with React Testing Library. No end-to-end suite yet — it would mostly
re-test the above through a slower harness while the UI is still moving.

## Deployment

Vite builds with `base: '/Tracker/'`. A GitHub Action builds on push to `main`
and deploys the output to Pages, replacing the current legacy `/docs` source —
Pages `build_type` moves from `legacy` to `workflow`. After that switch `docs/`
holds documentation only, including this spec, and is no longer the published
site root.

The live site stays at https://mirxa08.github.io/Tracker/.

## Out of scope

Deliberately excluded, and why:

- **Accounts and cloud sync** — see scope decisions
- **Zoom levels** — one scale, per the decision above
- **Sharing or collaboration** — requires a backend
- **Recurring events** — no evidence they are needed; a recurrence engine is a
  large addition to the schema and the UI
- **Notifications or reminders** — needs a service worker and permission flow;
  the now-line already answers "what is happening right now"
