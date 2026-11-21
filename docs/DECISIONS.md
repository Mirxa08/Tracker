# Tracker: decisions made while you were away

Source: `progress.md` in this folder. It holds 35 numbered rulings (1-35). The resume note that says "1-31" predates rulings 32-35; all 35 are covered here. Ruling numbers are in parentheses so you can look each one up.

State at the end of the ledger: Tasks 1-14 are implemented and reviewed. 228 tests pass across 23 files and `tsc` is clean. The hardening batch (A1-A13) has been dispatched but its results are not in the ledger. The final whole-branch review has not run. Nothing has been merged to `main`, and Pages has not been switched to the workflow. The ledger records no publish step as done.

## 1. Look at these first

### Dark is the default theme (25) — your call

The design doc says `prefers-color-scheme` is respected on first visit. I overrode that. New projects get `settings.theme = 'dark'`, and the app applies `data-theme` from that setting. A project set to `'system'` follows the OS and updates live. I took the spec's other clause, "Dark by default, matching the reference", as the binding one, because the reference screenshot is dark.

To reverse it: change the `createProject` default from `'dark'` back to `'system'`, and change the `project.test.ts` assertion that pins it. The hardening item A10 is written so that flipping the default fails a test, so reversing it has to be deliberate.

Ruling 23 was my first attempt at this and it was wrong. See section 7.

### Colour control in the event dialog (30) — your call

The design says the dialog offers "colour, image and notes optional". The plan had no colour control, so every event could only take its track's colour. I added a native colour input that defaults to the chosen track's colour. It has no palette and no new dependency. An untouched add stores exactly what it stored before.

To remove it: delete the colour input and its `draft.color` handling in the event dialog. `addEvent` already falls back to the track colour.

### Tier C: left undecided because they need your judgment

- The now-line pill scrolls away vertically while the header bands stay put. Say whether that is intended.
- NotesTable has no remove-column control, so a mistaken column cannot be removed. This also leaves `applyDraft`'s notes-clearing branch unreachable from the UI.
- An event's colour cannot be reset to "follow the track". Changing the track in the edit dialog does not recolour the event.
- The timeline height uses a hardcoded 96px offset (`calc(100vh - 96px)`). `--viewport-offset` is never defined. It is about 16px too generous against the measured value, and a taller header would give a double scrollbar. `100vh` also has the mobile toolbar quirk.

### Also yours: publishing

You authorised merging to `main` and switching Pages to the Actions source, and said you take full responsibility. That withdrew my earlier decision to hold the merge (7, 13). The plan is: merge and push first, then `gh api -X PUT repos/Mirxa08/Tracker/pages -f build_type=workflow`, then watch the Actions run and check that the live URL serves the real app with assets under `/Tracker/`. The CI workflow runs `npm test` before `npm run build`, so a red suite blocks the deploy.

## 2. Data safety and storage

- **Reorder never deletes (11).** The plan's `reorderTracks` silently dropped any track missing from the id list and orphaned its events. It now dedupes the ids, keeps every track, appends omitted ones in their existing order, and ignores unknown ids. `deleteTrack` is the only way to remove a track.
- **Storage failures recover (15).** A rejected `openDB` used to stay cached, so one transient failure disabled persistence until reload. The cache is now cleared on rejection and on a `terminated` event. A "no storage" error is no longer re-wrapped as a generic "Saving failed" message.
- **Blob test shim (12).** jsdom Blobs do not survive `structuredClone` in fake-indexeddb. I added a `structuredClone` shim in `setupTests.ts` that passes Blob and File through. I kept the `blob.size` assertion rather than delete it, and did not swap the global Blob. The reviewer noted this proves a Blob reaches the storage code, not that real IndexedDB serialises it. Only a real browser shows that.
- **Import keeps `width: 0, height: 0` on images (16).** Nothing reads those fields. Carrying real dimensions would change the published export format, and recomputing them would need an image decoder in the import path. A comment marks it as deliberate.
- **Failed import cleans up its images (17).** A try/catch deletes any image records already written before rethrowing the original error. Cleanup errors are swallowed so the original failure surfaces. Import never overwrites an existing project, and a newer `schemaVersion` is rejected.
- **Unreachable `trackId` fallback in import stays (18).** `validateProject` already rejects dangling ids. The fallback is a guard and is commented as one.
- **Undo is narrowed (20).** The plan's undo takes a whole-project snapshot, so delete, then edit something else, then undo would have silently reverted the edit. Every mutating action, plus `selectProject` and `removeProject`, now clears undo. Undo therefore means "undo the delete I just did". The design doc's "undoable for the remainder of the session" is narrower than promised. I rejected per-entity restoration because it changes a type four later tasks compile against.
- **The provider owns persistence (22, and the Task 8 fix round).**
  - It flushes a pending save on unmount, because a dropped 300 ms debounce loses the last edit with no server to recover from.
  - It flushes when the current project changes. Without that, edit A then switch to B inside 300 ms lost A's edit.
  - It deletes a removed project's row in the provider, not in a later UI task.
- **Failed storage open means in-memory only (24).** In private mode the app seeds an in-memory project and a `persistent` flag stops all writes. Otherwise every edit would raise a save-failure banner. Cost: that session does not persist, which is what the banner says.
- **Replaced images are swept, not prevented (28).** An edit cannot clear `imageId`, so replaced images orphan. A sweep (hardening A3) will diff referenced ids against stored keys. It must be mutation-proved against an event that still references its image, since a sweep bug deletes live data.
- **Image conversion silently falls back to PNG on browsers without WebP encoding (Task 6 review, minor).** That costs size, not data. It is deferred.

## 3. Time and timezone handling

- **Test timezone pinned to Europe/London (10).** `process.env.TZ` is set at the top of `vite.config.ts`, with no new dependency. Without the pin, the DST tests could not fail on this machine (Pakistan) or on CI (UTC). A mutation check showed the plan's prose overstated things. An unrounded naive `dayIndex` fails the tests, but a `Math.round` one passes. The tests catch a narrower bug class than the plan claimed. The Task 3 reviewer's matrix showed they do fail unrounded, floor and ceil variants.
- **Moves keep wall-clock time per day (31).** Dragging across a DST change shifts an event's absolute duration by an hour. I kept the brief's `shiftDays` behaviour because a 00:00-to-00:00 event must stay on day boundaries. Exact-millisecond duration is proven only for non-DST spans, timed events and hour moves.
- **Jump-to-now is gutter-aware (33).** The brief's `x - clientWidth/3` ignores the sticky 190px gutter that overlays the same scroller. The new expression is `x - (clientWidth - gutterWidth)/3`. In the browser the line sits at 0.333 of the visible canvas, up from about 0.22 with the old formula.
- **Export filename uses the local date (34).** It used the UTC date, which names the wrong day for evening exports in positive-offset zones.
- **Bars get a minute-tick `now` (Task 10, accepted).** A countdown badge can be up to 59 seconds stale after an event ends. This keeps every bar out of a 1 Hz render. A comment explaining it is queued (A12).
- **Year 0-99 trap (Task 11 fix round).** `new Date(y, ...)` maps years 0-99 to 1900-1999, so typing "26" stored 1926. It was fixed in that round.

## 4. Visual layout and z-order

- **One scroller (Task 9 fix round).** `.timeline__viewport` scrolls both axes. Bands stick to its top, and the gutter and month labels stick to its left. No descendant sets `overflow`, so image bleed is not clipped. I chose this over lifting the bands out so bars, bands and the now-line share one coordinate space.
- **Z-order scale (Task 10; dialog and detail values from Task 12 and the Task 11 fix round).**

  | Layer | z-index |
  |---|---|
  | bars | 10 |
  | now-line | 20 |
  | bands | 30 |
  | gutter | 40 |
  | corner | 50 |
  | detail panel | 60 |
  | dialog backdrop | 70 |

  The scale is pinned by `zorder.test.ts`, which does not yet cover the dialog backdrop (A9).
- **Upcoming events (Task 10).** A white-wash `event-bar--upcoming` class gives not-yet-started events the lighter fill the design asks for. The brief's CSS lacked it.
- **Bar overlap (Task 10, parked).** Two overlapping events overlap visually. The plan has no lane-packing. This is not in any tier.

## 5. Dialog and UI behaviour

- **Track choice (27).** "Chosen from existing tracks or created inline" is met by Task 13's Add track control. The dialog says "Create a track first" when there are none. Cost: one extra click for a first-time user.
- **Escape-to-close and a focus trap (29).** Neither is in the design or the brief. Both are queued for the hardening batch (A4).
- **Brief defects fixed in Task 11.**
  - An edit that removed every notes column kept the old notes. `applyDraft` now clears them.
  - The "start and end required" message named neither field. It is now two field-specific messages.
- **Task 13 added a delete control in `App.tsx` (Task 13 review).** The brief has none.
- **Other brief defect (Task 12).** `detail.css` had z-index 9, which painted the detail panel under what it describes. It is now 60.

## 6. Testing discipline

- **Mutation proof is required (Task 3 onwards).** A guard that has never been seen failing cannot be told apart from one that cannot fail. For nearly every task the implementer breaks the code on purpose and shows the named test fails. Reviewers check that the failure output matches the property claimed.
- **`StoreProvider` was first shipped without tests (3).** That was reversed by 22 once the data-loss risk was understood.
- **Tests added where mutants survived (21).** The brief's reducer tests missed `currentProject` falling back to the first project, and `selectProject` leaving a dialog open. Both now have tests.
- **Reviewer runs alongside the next implementer (9, amended by 14).** I ran a task's review at the same time as the next task's implementer when the two did not share files. Ruling 14 allowed pairing Task 6 with the unreviewed Task 5 even though Task 6 consumes two of its functions. Two implementers never run at once, because both commit.
- **Reviewer mutations confuse parallel agents (Task 14).** A parallel reviewer's mutation made the tree look corrupted to the Task 14 implementer. The fix is to tell parallel implementers that a reviewer may transiently mutate files.
- **Browser evidence rules.** A check must test the defect, not the happy path. Defaults are checked by forcing the opposite signal. Occlusion is checked with `elementFromPoint`. A control experiment (forcing the old z-index back inline) shows the defect was real. A stale dev server invalidates every visual check made against it.
- **Review findings are routed to whichever task owns the code (19, 26).** Task 7's minors were deferred into the hardening batch. Its two residual data-loss lines (A1, A2) come first. The one Important finding in Task 10 (`useImageUrl` rendering a revoked blob URL) was handed to Task 11 rather than opening a Task 10 fix round. Cost: if the receiving task could not take it, it would return to the batch.

## 7. What we got wrong, and how it was caught

### Decisions later found wrong or superseded

- **Ruling 23 (theme default) was wrong on the facts; 25 supersedes it.**
  - I moved dark into `:root` and put light under `@media (prefers-color-scheme: light)`. `no-preference` was removed from the spec, so every browser with no OS signal matches `light`. The change altered the cascade and changed nothing for real users.
  - My own earlier browser check was unsound. The pane emulates the color scheme to match the app, so "dark theme applies" read a media-query result, not a default.
  - The real defect: `settings.theme` existed, was validated, and nothing applied it to the DOM. Ruling 25 fixes that. The implementer's report held the evidence (a white background under the default) and I did not join it up.
- **Rulings 7 and 13 (do not merge or publish) were withdrawn** by your explicit authorisation. Ruling 13 had held even under the "make all decisions yourself" instruction.
- **Ruling 3 (no `StoreProvider` tests) was superseded by 22.** Review of Task 8 found two further data-loss paths, the switch-flush and private-mode paths, that the single-project tests could not see.
- **Plan text overruled on review:** the plan's `reorderTracks` (11), its `db.ts` caching and error wrapping (15), its private-mode handling in Task 8 (Task 8 fix round 2, 24), and its jump-to-now formula (33). In each case the reviewer was right.
- **My M2 mutation instruction in Task 8 was wrong.** It could not catch the `found ?? projects[0]` fallback. The implementer added a `currentId: null` case that does.
- **The plan's DST claim (10)** was overstated, as noted in section 3.
- **Ruling 5 (`snapToDay`) outcome is not recorded.** The ledger does not say whether it was used or deleted.
- **Concern with Task 12 hour snap (deferred):** it uses `DAY_WIDTH/24` per hour, which is off on 23- and 25-hour days.

### Tests that proved nothing

1. **DST tests that could not fail (10, Task 3).** The suite's zone and CI's zone had no DST transition. Found by the implementer reporting it, then fixed with the TZ pin.
2. **The TZ pin exercised nothing (Task 11 review).** Every datetime fixture sat in November or December, when London is UTC. A `toISOString().slice(0,16)` mutant passed all 155 tests, and the dialog's submitted start and end were never asserted. Found by asking what the test would do if the code were wrong. Fixed with July fixtures that assert exact submitted ISO strings.
3. **Task 8 vacuous delete.** The loaded-clears-undo test used a separate seeded state, so its delete was a no-op. Found by mutation proofs.
4. **Task 9 header-memo test counted the wrapper.** Its Profiler measured the wrapper re-rendering, not the memoised component, so two mutants survived. It was replaced with a test that counts `days.map` calls. An older sibling test, "header bands DO re-render when the range changes", is still vacuous (residual).
5. **Task 12 drag tests measured nothing.** jsdom has no `PointerEvent`, so `fireEvent.pointer*` dropped `clientX` and `shiftKey`. The brief's tests would have passed against a zero-pixel drag. Fixed with a polyfill in `setupTests.ts`.
6. **Task 12 false kill.** A mutant "died" only on float formatting. It was re-killed for the real reason.
7. **Task 11 bad mutant of its own.** The first F1b mutant hit the NaN branch, not the line under test. The re-review confirmed that diagnosis was genuine.
8. **Task 13 self-referential jump tests (33).** Four assertions computed `expected` with the same `- clientWidth/3` expression as production, so they asserted the code agreed with itself and could not detect the gutter bug. Restoring the old formula now fails three tests.
9. **Task 13 other weak tests.** The clamp fixture never went negative, and the Now button was untested at App level. Both were self-caught and fixed.
10. **Task 7 round-trip test** passed while start/end, track ids, settings or image bytes were dropped. The implementer flagged it. It was fixed, with nine mutations proving each property.
11. **Task 10 `.catch` on the image lookup.** Removing it leaves every assertion green. The runner's unhandled-rejection exit code catches it, not a test (A8).
12. **Task 5 reasoning gap (reviewer).** The `terminated` handler test calls `terminated()` directly. It proves the handler clears the cache, not that a browser fires the event.

Outside the tests: my browser check of Task 9 passed over the sticky-band defect, because it only appeared with many tracks. Task 9's re-review also found that the z-index fix put the now-line over the gutter.

## 8. Build and deploy

- **Vitest ^5.1.1 instead of the pinned ^3.0.0 (8).** Three advisories sat in vitest's own tree, two critical, and CI runs `npm ci && npm test` on every push. I verified `npm audit` shows 0 vulnerabilities and nothing reaches the browser bundle. Cost: one config file of churn, caught at once by the smoke test.
- **No `tsconfig.node.json` (1).** The plan listed it with no contents. `vite.config.ts` stays un-type-checked, as before.
- **`defineConfig` stayed on `vite` (2).** It was a contingency, and it worked.
- **Node.** Node 26.13.1 and npm 11.20 were installed on this machine by winget, with your approval. The shell PATH is stale, so each command needs the PATH prefix.
- **CI action versions bumped (32).** The brief's actions were a major behind: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5, and Node 20 to 22. GitHub forced actions onto the Node 24 runtime in June 2026 and Node 20 went EOL in April 2026. Cost: the first deploy run could fail, visibly and revertably.
- **`vite.config.ts` carries two test-driven changes.** One is the TZ pin. The other is a `css.include` regex (`(theme|timeline|event-bar)\.css`), needed so tests can read the stylesheets as text. The regex is unanchored (A12).
- **Task 14.** It deletes `docs/index.html` and `docs/.nojekyll`, and the README was extended with how to use the app (commit 21aa7c0).
- **Co-author trailer (35).** Commit 6188128 keeps a trailer naming Sonnet 5.5 as written by the subagent. I did not rewrite history.

## 9. What is NOT done

- **Hardening batch (A1-A13) is dispatched; results are not in the ledger.**
  - A1-A2: assert `createdAt` survives import, and add a second distinct image to the round-trip seed. These are the last residual data-loss exposure.
  - A3: image GC sweep. A4: Escape and focus trap. A5: guard the TZ pin. A6: `remainingLabel` boundaries.
  - A7: reject duplicate track and event ids on import. A8: assert the image `.catch`.
  - A9: dialog backdrop in `zorder.test.ts`. A10: strengthen `theme.test.ts`. A11: `engines` in `package.json`.
  - A12: strip BOMs, anchor the regex, add the minute-tick comment. A13: clear the dialog error once the field is fixed.
- **Final whole-branch review** on the most capable model, then merge, push, switch Pages, and verify the live URL.
- **Open questions from Task 7:** `migrate()` is the identity, so "migrates older versions forward" exercises nothing. It becomes a defect the first time `SCHEMA_VERSION` increments without a test. Whether `validateExportFile`'s per-field rejection messages are covered in `schema.test.ts` has not been checked.
- **Tier B, left on purpose (low value or speculative):**
  - StrictMode double-mount tests.
  - The `pointerId` and concurrent-drag guard (mouse-only desktop use).
  - A non-ASCII project name slugging to `project-<date>.json`.
  - `iso()` accepting non-ISO strings via `Date.parse`.
  - `fractionOfDay` using a fixed 24h divisor, so about 1.4px of error for one hour a year.
  - Orphan image entries in hand-edited imports.
  - `vi.doUnmock` not in a `finally`.
  - IndexedDB `blocking` handlers, not needed at `DB_VERSION` 1.
  - Various "coverage could be broader" lines.
- **Deferred but placed in no tier (notable ones):**
  - Exporting with images silently skips an image missing from the store, so a "complete backup" can be incomplete. The ledger says the export UI should surface a count.
  - A failed `deleteProject` leaves the row, so a removed project can return on the next load. Untested.
  - A long event name can run under its badge on short bars.
  - An edit dialog for an event that no longer exists shows "Add event".
  - The undo status line pushes the timeline down a line.
  - `dataUrlToBlob` rejects valid data URLs with extra parameters.
  - `bitmap.close()` is not in a `finally`.
- **Not verified in a real environment.** Touch input, Shift hour-snap with a real pointer, real IndexedDB Blob serialisation, and the bands region under the dialog backdrop.

---

# Later decisions (36–40), made after this document was first written

## 36 — Deleted the unused `snapToDay` helper
Ruling 5 had said "use it or delete it" and recorded no outcome. It turned out to be exported,
tested, and called by nothing in production — a test keeping dead code looking covered. Deleted.
Day snapping is done by `applyDrag`. **To reverse:** it is three lines of arithmetic.

## 37 — The image sweep deliberately does not collect old orphans
The sweep removes image blobs no event references any more. It only considers ids this session
has seen referenced; it does not diff against everything in the store. An unknown blob cannot be
told apart from an upload in flight, an import caught mid-write, or another browser tab's data,
and deleting one of those is data loss. **Cost:** orphans left by earlier sessions are never
reclaimed — wasted space, never lost data. The implementer proposed this refusal and I accepted it.

## 38 — Sakuga UI turned out to be copy-paste, not a package
You chose the React library knowing it would break the three-dependency rule. It did not: the kit
is copy-paste source, not an npm package, so **runtime dependencies are still exactly `react`,
`react-dom` and `idb`**. Tailwind v4 is build-time only and the site still works offline.

## 39 — The kit has no form components, so we built them
Sakuga ships heroes, effects and layouts — no app bar, dialog, select, input, badge or panel.
We took its visual language and its spotlight technique, and authored the missing primitives in
`src/ui/sakuga/`: SpotlightSurface, Button, IconButton, Field, Input, Select, Badge, Panel,
Segmented. The spotlight effect is credited to the kit (MIT, Prateek Raiger) in the CSS.

## 40 — Existing CSS keeps owning layout
Tailwind and the new components own the finish only. Converting the hand-written CSS to utilities
would have broken 262 computed-style assertions for no visual gain.

## Corrections to this document

**Ruling 25 was never actually implemented.** This document, and the ledger it was written from,
said dark was the default. In the code it was not: `createProject` still wrote `'system'`, nothing
ever set `data-theme`, and the test that claimed to guard it only read CSS text. The final review
caught it. It is implemented now, and verified live in production (`data-theme="dark"`), together
with the Dark/Light/System control the design doc's "a light theme is available" always needed.

## What shipped

Pushed to `main` as `da7a9d5` and deployed by GitHub Actions. Live at
https://mirxa08.github.io/Tracker/ with assets under `/Tracker/`, asset hashes identical to the
locally verified build. 291 tests in 26 files, `tsc` clean, no console errors in production.
