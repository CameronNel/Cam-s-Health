# Isolated phone screenshot audit

Import `fixture.mjs` from a Node ESM script. Start the local app on port 5187, or set `CAMS_AUDIT_ORIGIN`. The installed Chromium/Playwright paths are specific to this Codex environment. Every public-health and private-life API is mocked, all writes stay in memory, unrelated external requests are blocked, and service workers are blocked. The optional service-worker shim exercises the reviewed-update UI without installing a worker.

```js
import {createFixture,gotoView,openAction,expandDetails,captureScroll} from './fixture.mjs';
const fixture=await createFixture({width:360,textScale:200});
try {
  await gotoView(fixture,'nutrition');
  await captureScroll(fixture,'nutrition-360-200');
  await openAction(fixture,'[data-act=food-log]');
  await expandDetails(fixture.page);
  await captureScroll(fixture,'food-form-360-200');
} finally { await fixture.close(); }
```

`captureScroll` saves top, overlapping viewport screenshots down to the bottom, document and modal scroll surfaces, plus a JSON manifest with sizing/clip/target/obstruction candidates. Use `captureTransition` with `reducedMotion:'no-preference'` to inspect animation frames. Use `simulateKeyboard(fixture,selector,500)` to focus at the resting height and then reduce the viewport, triggering the actual app keyboard rules. Starting a fixture at 500px alone does not simulate the keyboard height change. Test widths 424/390/360 and text scales 100/130/200. A default fixture uses long realistic synthetic names/notes, 45 dated check-ins, meals, workouts, recipes, mail, tasks and pickups. Use `empty`, `healthError`, `privateError`, `loadDelay`, `offline`, `writeError`, `mixedMethods` and `updateReady` for failure/edge states.

Screenshot inspection by the builder and independent reviewer is mandatory. Diagnostics identify candidates; they do not substitute for viewing the images and cannot produce a perfect score. Release blockers must be fixed and recaptured. `inventory.json` enumerates menus, submenus and variants; `capture-all.mjs` is the baseline enumerator.

For parallel review workers, provide a Playwright browser-server endpoint in the JSON file named by `CAMS_AUDIT_BROWSER_FILE` (default `/tmp/cams-life/audit-browser.json`, with an `endpoint` field). The fixture and enumerator reuse it and serialize browser access through a process-owned lease. Always close a fixture in `finally`. Without that file, a fixture starts its own browser. Reusing a browser reduces process pressure; it does not repair an already exhausted execution environment.

When a transition reveals previously hidden feedback, a disclosure or a new form, apply `scaleText(page, percentage)` again before the enlarged-text screenshot. The helper scales visible nodes at the time of invocation; a hidden empty status line is not evidence that its later message was tested at 200%. Repeated preview discrepancies must be checked against the raw original PNG and, when needed, SHA-256/pixel comparison. Gallery previews alone must not be reported as app flicker when the original bytes are identical.
