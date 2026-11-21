# Tracker

Build day-wise timeline trackers in the browser. Projects hold named tracks of
events with optional images and notes tables. Everything stays in your browser;
projects move between devices as JSON.

Live: https://mirxa08.github.io/Tracker/

## Using it

A **project** is one timeline. Add as many as you like and switch between them
from the bar at the top.

Inside a project, add named **tracks** — one row each — and add **events** to a
track with the `+` button beside its name. An event needs a name and a start and
end; an image and a notes table are optional. Images are downscaled in the
browser before they are stored.

- Each bar shows how long is left until the event **ends**, as `12d`, `16h` or `45m`.
- A vertical line marks the current time. **Now** scrolls it back into view.
- Drag a bar to move it, or drag either edge to change its start or end.
- Deleting an event or a track can be undone.
- **Export** writes the project to a JSON file; **Import** adds one as a new
  project and never overwrites what you already have.

Nothing is sent anywhere. Projects live in your browser's storage, so clearing
site data for this page deletes them — export anything you want to keep, and use
the same file to move a project to another device.

## Develop

```bash
npm install
npm run dev     # local dev server
npm test        # unit and component tests
npm run build   # production build into dist/
```

## Documentation

- [Design](docs/superpowers/specs/2026-11-20-tracker-design.md)
- [Implementation plan](docs/superpowers/plans/2026-11-20-tracker.md)

Pushing to `main` builds and publishes the site via GitHub Actions.
