# Cam’s fitness tracker: persistent chat workflow

## Start here on every fitness logging turn

The user wants to speak naturally in chat, have the information committed to GitHub, and receive updated daily totals automatically in the same reply. This repository, `CameronNel/Cam-s-Health`, is the source of truth for the app. The canonical record is `dist/data/health.json` on `main`. App: https://cams-health.cameronnel111.chatgpt.site . No application backend or AI key is needed. The repository is public: do not add unrelated medical, relationship or personal history.

Read the latest `dist/data/health.json` through the GitHub plugin before answering a fitness question, giving the next workout, or changing records. Do not rely on an earlier chat snapshot. The app reads GitHub live; data-only commits do not need app redeployment. User authorization in chat to log food/activity authorizes the necessary record commit. Do not ask for repeated confirmation of routine updates.

## How to log

1. Resolve the intended date using `profile.timezone` (Europe/Amsterdam), not UTC. An example, quoted scenario or joke is not an actual entry. Never log the illustrative 10k steps, 90-minute workout or food examples from the app creation request.
2. Reuse the profile, program, recipes and actual records. Keep unknown values `null`, not zero. Use stable IDs for entries. Avoid duplicate logging when the same report is repeated: inspect existing records and source information first. If genuinely ambiguous, ask a concise question and log the unambiguous portion.
3. Food: preserve user quantity and description. Prefer a product label or saved recipe. If using an estimate, set `estimated: true`, record assumptions in `note`, and identify the source. Browse authoritative food nutrition sources when new external estimates are needed. Do not invent portion sizes without clearly marking the assumption. Missing nutrition stays null and is excluded from known totals with an explicit incomplete-log note.
4. Steps: a report such as `daily steps = 10k` sets that date's total to 10000; it does not add 10000. Only add when the user explicitly reports an increment. Apply the same distinction to water. Preserve other metrics.
5. Workout: resolve which session was actually discussed/completed. `done in 1.5 hours` means 90 minutes; do not manufacture weights, reps or completed sets. **Every workout record requires a stable, unique, non-empty `id`**, including custom and partial workouts. Use `id`, `sessionId`, `name`, `status` (`completed` or `partial`), `durationMin` and optional `notes`/actual exercises. Rest uses `sessionId: "rest"`, custom activity uses null. Workout IDs must not collide with food IDs on the same day. A completed prescribed session advances the rotation. Partial or custom sessions do not. Missing duration does not by itself mean an explicitly completed session is partial.
6. A correction edits the existing entry. Do not append a second entry for the same meal. Preserve unrelated dates/fields, recipe sources, training restrictions and estimates. Source calorie/macro disagreement is flagged with `reviewRequired: true`; retain the original estimate until it can be verified.
7. Fetch current file content and blob SHA, apply the minimal mutation, update `updatedAt`, and run `npm run validate` against the result before writing. The active contract is `dist/body.js -> validateHealth()`, which wraps `dist/model.js -> validate()`. JSON parsing alone is not schema validation. Missing or duplicate entry IDs are fatal because the app will reject the entire newer file and display an older cached copy. Then write with GitHub `update_file` using that SHA. If the SHA conflicts, fetch again and reapply only the requested change. Never force overwrite. If an edit to the same record conflicts semantically, show the conflict instead of silently replacing it. A create for a genuinely absent path uses create_file. If execution is unavailable, explicitly validate all relevant constraints and state that executable validation was not run; do not claim it was.
8. Read back the saved file after a successful write and verify the actual change/totals with the same validator. If a timeout leaves the save ambiguous, read first before retrying to prevent duplication. Never say saved when write/verification failed. A completed data commit is not proof that the hosted UI was rendered or republished.

## Reply automatically after every successful log

Keep it brief: date, calories and remaining target, protein/carbs/fat, steps, workout/duration, and next session when useful. Distinguish estimates and partial logs. Unknown steps/training are `not logged`; an empty food day is not zero consumption. Do not claim a calorie deficit from intake alone or add guessed exercise calories to the allowance.

Provide the app link with `?date=YYYY-MM-DD` when relevant. If the user requests a screenshot, open an authorized browser preview of the actual current app, capture the selected date and send it. Do not draw a screenshot from made-up data or claim to have captured one when unavailable; provide the app link and totals instead. Screenshots can be used after updates when the browser is available, but should not block a successful data commit and immediate brief. Local build screenshots must be labelled as previews, not hosted-app captures.

## “Hey, what are we training today?”

Read current data. Find the last completed program/rest session dated on or before the requested day, then select the next ID in `training.rotation`. No completed history means the first session is proposed, not completed. Never skip sessions merely because a calendar day elapsed. If the day's session is already completed, say so and name the next session separately. Return exercises, prescribed sets/reps and relevant exercise notes. Respect `profile.trainingStatus` and restrictions. `awaiting clearance` or `paused` is not ready-to-train permission. Do not infer clearance from elapsed time.

## Schema

Top level: `schemaVersion:1`, `updatedAt`, `profile`, `training`, `days`, optional `recipes`, `provenance`.

`days[YYYY-MM-DD]`: `{ food:[], workouts:[], steps:null, waterMl:null, weightKg:null, notes:"" }`, with optional `body`.

Food: `{id,name,quantity,kcal,protein,carbs,fat,estimated,source,note}`. Nutrition units are kcal and grams; values may be null.

Workout: `{id,sessionId,name,status,durationMin,notes}`, with optional `actualExercises: [{name,sets,reps,load}]`. `id` is mandatory. `sessionId` is either `null` for custom activity or a valid stored session ID. `durationMin` may be `null`. Actual exercise `sets` are positive integers or null, `load` is kg or null, and `reps` may be a string, number or null. Do not replace unknown performance with the prescribed rep range.

Food and workout IDs must be unique within the same day because the validator checks them in one shared entry namespace. Never store aggregate totals as an independent source of truth; derive them from entries. Recipes contain batch `yieldG`, `total`, `per100g`, ingredient assumptions and notes.

## Body measurements (Studio 02)

Read `docs/STUDIO-02.md` and `dist/body.js` before adding body fields. Keep the schema backward compatible; existing days do not need a `body` property.

- Weight uses the existing `day.weightKg` only. Never duplicate it inside `body`. Profile height is `profile.heightCm`.
- Optional `day.body`: `{bodyFatPct, method, measurementsCm, notes, recordedAt}`. The date key is the measurement date; `recordedAt` is when it was entered or corrected.
- Exact measurement keys: `neck`, `shoulders`, `chest`, `waist`, `hips`, `upperArmLeft`, `upperArmRight`, `forearmLeft`, `forearmRight`, `thighLeft`, `thighRight`, `calfLeft`, `calfRight`.
- Store circumference in cm and weight in kg; convert reported lb/in explicitly. Body fat is percentage points, e.g. 20 means 20%, not 0.20.
- Exact methods: `Not specified`, `BIA scale`, `BIA watch`, `Calipers`, `DEXA`, `Visual estimate`, `Other`. Preserve the user's stated method and uncertainty. Do not invent which arm or method they meant; clarify an ambiguous side rather than copying the value to both sides.
- Keep unknown values null. Do not import historical estimates as measurements for today. Never copy a prior reading into a fresh date just to fill the graph. Correct only the requested date/field, preserving unrelated fields.
- Derived fat/fat-free mass requires same-day weight and body fat. Do not call fat-free mass muscle mass. Do not calculate a diagnosis from the chart.
- Records in this public repository are public. Do not add progress photos or unrelated sensitive information. Do not imply that browser authorization makes the data private.

## Working on the app

Static HTML/CSS/ES modules live in `dist/`; no install or bundle is required. `node scripts/serve.mjs --port 5173` is for ordinary local use; use the Sites supervised preview in its managed environment. Run `npm test` and `npm run validate` after behavior/schema changes and validate the actual candidate health JSON before data commits. Browser tokens must remain in memory only and must never be committed, cached, logged or sent to any origin except GitHub's API. The data cache is a fallback, never a successful save. Preserve error/stale states and conflict handling.

The Studio 02 entry point loads `studio.js` and `studio.css`; new validation and persistence are in `body.js` and `sync.js`. Legacy files remain for reference. Do not patch only the unused legacy `app.js` and expect the new UI to change.

The Sites manifest identifies the published static app. Read the Sites skills when available and redeploy after UI changes. GitHub remains the canonical source and data store. Commit source changes to GitHub as well as publishing. No database, server proxy, analytics, or background app process is needed. The Studio 02 build session had no Sites publisher, so hosted deployment was not verified. Never claim the new UI is live until a publishing action succeeds and the deployed build is checked.

The Tracker integrity workflow checks syntax, tests and the actual committed data. Without branch protection it does not prevent direct bad commits or repair them automatically. Keep the missing-workout-ID regression tests. Test fixtures must remain isolated from `dist/data/health.json` on main.
