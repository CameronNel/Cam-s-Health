# Studio 02

Source release prepared on 22 September 2026. This document describes the repository build, not proof of deployment to the hosted app.

## Release and hosting

The entry point is `dist/index.html`, which loads `studio.js` and `studio.css`. `studio.js` uses the original `model.js`, the new `body.js` validator and measurement helpers, and `sync.js` for GitHub persistence. The earlier `app.js`, `styles.css`, `theme.css` and `gestures.js` remain in the repository for reference; the new entry point does not load them.

Publish the complete `dist/` directory through the existing project identified by `.openai/hosting.json`. Source changes require publishing. Data-only commits still do not. The original project is `appgprj_6ab28b4443e48191a33350023101edf6`. The build session could write to GitHub but had no publisher for that project, so the hosted rollout was not verified. Do not tell the user that a refresh will load Studio 02 until publishing succeeds.

No application backend, database, analytics, remote font, or runtime package dependency was added. The UI release leaves `dist/data/health.json` unchanged. Never deploy a synthetic test fixture in place of the user's canonical record.

## Body tracking

The Body tab supports dated body weight, body-fat percentage, measurement method, notes and 13 circumference fields: neck, shoulders, chest, waist at navel, hips, left/right upper arm, left/right forearm, left/right thigh, and left/right calf. Profile height is editable under More > Targets & profile.

Charts show actual readings for 7, 30, 90 days, or all history up to the selected date. They do not fill missing dates with zeros or fabricate a trend before readings exist. A single reading is one point. Body-fat readings made with different methods are shown as unconnected points. Weight's seven-day mean uses only recorded observations and displays the observation count. History entries open the correct date for correction. CSV export uses metric storage units.

Display units can be kg/cm or lb/in. Storage remains metric. Unchanged imperial fields retain their exact original metric values. Previous readings are hints, not silently copied into a new date.

### Backward-compatible schema

`schemaVersion` remains 1. Existing daily `weightKg` is the only canonical weight field. Do not create another weight field inside `body`.

```json
{
  "weightKg": null,
  "body": {
    "bodyFatPct": null,
    "method": "Not specified",
    "measurementsCm": {
      "neck": null,
      "shoulders": null,
      "chest": null,
      "waist": null,
      "hips": null,
      "upperArmLeft": null,
      "upperArmRight": null,
      "forearmLeft": null,
      "forearmRight": null,
      "thighLeft": null,
      "thighRight": null,
      "calfLeft": null,
      "calfRight": null
    },
    "notes": ""
  }
}
```

`body` is optional. Values may be null. The form adds `recordedAt` when saved. Supported methods are `Not specified`, `BIA scale`, `BIA watch`, `Calipers`, `DEXA`, `Visual estimate`, and `Other`. Optional profile height is `profile.heightCm`.

Weight must be greater than 0 and no more than 500 kg; body fat greater than 0 and no more than 99.9%; circumference greater than 0 and no more than 400 cm; height greater than 0 and no more than 300 cm. These are input sanity bounds, not clinical classifications. Leave unknown values null rather than manufacturing a value to satisfy the validator.

Same-day fat mass and fat-free mass estimates are derived only when both weight and body-fat percentage are entered for that date. Fat-free mass is not labelled muscle mass. No BMI diagnosis, automatic body-fat inference, or progress-photo upload was added.

## GitHub authorization and privacy

The ChatGPT GitHub connector and the browser are separate sessions. Public read-only use requires no token. Browser saves require the user to enter a fine-grained token into the app's password field, restricted to Cam-s-Health with Contents: Read and write. Do not ask for the token in chat. More > Connect browser editing explains the setup. Accepting a token verifies identity and read access; an actual save verifies write access.

The token is kept in a private in-memory field and sent only to `api.github.com`. It is never persisted to localStorage, source code, exports or health.json. Reloading or closing the tab drops authorization. The app does not promise permanent login.

The repository is public. Food, workouts and body measurements committed here are publicly accessible. The hosted app's audience setting does not change repository visibility. The release does not change that visibility or introduce a server to hide it.

## Save integrity

The active schema contract is `validateHealth()` in `dist/body.js`, which first checks IDs and then calls the original `validate()` in `dist/model.js`. Use `npm run validate` before every chat-driven data commit, not only UI edits.

All food and workout entries require a stable non-empty ID unique across both entry types within that day. Partial and custom workouts are not exceptions. The regression suite includes the September 22 missing-workout-ID failure.

The browser reads a fresh GitHub blob before saving, preserves unrelated records, validates before PUT, checks the current SHA, and re-fetches the immutable returned commit for exact read-back verification before reporting success. A disjoint 409 conflict is retried once against a fresh record; same-record conflicts are rejected by baseline checks. An ambiguous network failure is not blindly retried. Refresh before retrying to avoid duplicates.

Read-only fetching tries GitHub raw content first, then the API. Raw responses older than an already accepted record do not replace it. Invalid data is rejected with its date and entry path. A fallback copy is visibly labelled not live. A successful GitHub write is not the same as a verified browser render or successful hosted deployment.

## Interaction improvements

Five mobile tabs: Today, Food, Train, Body and More. Adaptive light/dark/system themes, safe-area navigation, keyboard focus styles, reduced-motion support, date selection, seven-day strip, explicit known-subtotal markers and empty states.

Food supports search, edit/delete, repeat-portion review and saved-recipe portion previews. Training supports long-press previews, actual exercise sets/reps/load input, explicit completion status and stable workout IDs. The wall-clock rest timer supports presets, pause/resume, +30 seconds, and a running timer after reload; it never infers workout duration. Browser background scheduling may delay its alert.

Forms preserve input when authorization is missing, protect unsaved edits with a discard confirmation, and detect conflicting changes. Unknown data stays unknown; the app does not mark a workout completed from elapsed time or automatically advance custom/partial sessions.

## Verification performed

Local release verification: 29 new Node tests passed. Existing repository tests are retained. JavaScript syntax checks passed. An isolated Chromium harness ran 15 integrated browser checks, including 42 screen/viewport combinations from 320 to 1440 CSS pixels with no horizontal page overflow and zero JavaScript exceptions during that suite.

The browser harness rendered the actual build with a local mirror of reported data and mocked GitHub requests. It exercised measurement saves, immutable read-back, missing-ID rejection, retained drafts, separate-date editing, custom sessions, meal repeat, timer behavior and token non-persistence. These were not real writes to the user's record and not an end-to-end test of the hosted site or physical Android device. Preview screenshots are local build previews, not proof of a hosted rollout.

`tests/studio.test.mjs` is repeatable with `npm test`. `.github/workflows/validate.yml` runs syntax checks, all Node tests and validation of the actual committed health record on main pushes and pull requests. A workflow file alone is not proof that a run passed. This check reports failure; without branch protection it does not block a direct commit or automatically repair data.

## Publish acceptance checklist

1. Pull the release commit and keep the existing canonical health JSON.
2. Run `npm test` and `npm run validate` on that checkout.
3. Publish its complete `dist/` through the original Sites project.
4. Verify Today displays the latest recorded totals and Body displays only real measurements.
5. Verify on the user's phone that navigation, date changes, the check-in form and GitHub authorization work. Any real test save must be an actual user-authorized reading, not synthetic body data.
