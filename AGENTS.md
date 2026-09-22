# Cam’s fitness tracker — persistent chat workflow

## Start here on every fitness logging turn

The user wants to speak naturally in chat, have the information committed to GitHub, and receive updated daily totals automatically in the same reply. This repository, `CameronNel/Cam-s-Health`, is the source of truth for the app. The canonical record is `dist/data/health.json` on `main`. App: https://cams-health.cameronnel111.chatgpt.site . No application backend or AI key is needed. The repository is public: do not add unrelated medical, relationship or personal history.

Read the latest `dist/data/health.json` through the GitHub plugin before answering a fitness question, giving the next workout, or changing records. Do not rely on an earlier chat snapshot. The app reads GitHub live; data-only commits do not need app redeployment. User authorization in chat to log food/activity authorizes the necessary record commit. Do not ask for repeated confirmation of routine updates.

## How to log

1. Resolve the intended date using `profile.timezone` (Europe/Amsterdam), not UTC. An example, quoted scenario or joke is not an actual entry. Never log the illustrative 10k steps, 90-minute workout or food examples from the app creation request.
2. Reuse the profile, program, recipes and actual records. Keep unknown values `null`, not zero. Use stable IDs for entries. Avoid duplicate logging when the same report is repeated: inspect existing records and source information first. If genuinely ambiguous, ask a concise question and log the unambiguous portion.
3. Food: preserve user quantity and description. Prefer a product label or saved recipe. If using an estimate, set `estimated: true`, record assumptions in `note`, and identify the source. Browse authoritative food nutrition sources when new external estimates are needed. Do not invent portion sizes without clearly marking the assumption. Missing nutrition stays null and is excluded from known totals with an explicit incomplete-log note.
4. Steps: a report such as `daily steps = 10k` sets that date's total to 10000; it does not add 10000. Only add when the user explicitly reports an increment. Apply the same distinction to water. Preserve other metrics.
5. Workout: resolve which session was actually discussed/completed. `done in 1.5 hours` means 90 minutes; do not manufacture weights, reps or completed sets. **Every workout record requires a stable, unique, non-empty `id`**, including custom and partial workouts. Use `id`, `sessionId`, `name`, `status` (`completed` or `partial`), `durationMin` and optional `notes`/actual exercises. Rest uses `sessionId: "rest"`, custom activity uses null. Workout IDs must not collide with food IDs on the same day. A completed prescribed session advances the rotation. Partial or custom sessions do not.
6. A correction edits the existing entry. Do not append a second entry for the same meal. Preserve unrelated dates/fields, recipe sources, training restrictions and estimates. Source calorie/macro disagreement is flagged with `reviewRequired: true`; retain the original estimate until it can be verified.
7. Fetch current file content and blob SHA, apply the minimal mutation, update `updatedAt`, and validate the result against the contract in `dist/model.js -> validate()` before writing. Missing or duplicate entry IDs are fatal because the live app will reject the entire newer file and display an older cached copy. Then write with GitHub `update_file` using that SHA. If the SHA conflicts, fetch again and reapply only the requested change. Never force overwrite. If an edit to the same record conflicts semantically, show the conflict instead of silently replacing it. A create for a genuinely absent path uses create_file.
8. Read back the saved file after a successful write and verify the actual change/totals. If a timeout leaves the save ambiguous, read first before retrying to prevent duplication. Never say saved when write/verification failed.

## Reply automatically after every successful log

Keep it brief: date, calories and remaining target, protein/carbs/fat, steps, workout/duration, and next session when useful. Distinguish estimates and partial logs. Unknown steps/training are `not logged`; an empty food day is not zero consumption. Do not claim a calorie deficit from intake alone or add guessed exercise calories to the allowance.

Provide the app link with `?date=YYYY-MM-DD` when relevant. If the user requests a screenshot, open an authorized browser preview of the actual current app, capture the selected date and send it. Do not draw a screenshot from made-up data or claim to have captured one when unavailable; provide the app link and totals instead. Screenshots can be used after updates when the browser is available, but should not block a successful data commit and immediate brief.

## “Hey, what are we training today?”

Read current data. Find the last completed program/rest session dated on or before the requested day, then select the next ID in `training.rotation`. No completed history means the first session is proposed, not completed. Never skip sessions merely because a calendar day elapsed. If the day's session is already completed, say so and name the next session separately. Return exercises, prescribed sets/reps and relevant exercise notes. Respect `profile.trainingStatus` and restrictions. `awaiting clearance` or `paused` is not ready-to-train permission. Do not infer clearance from elapsed time.

## Schema

Top level: `schemaVersion:1`, `updatedAt`, `profile`, `training`, `days`, optional `recipes`, `provenance`.

`days[YYYY-MM-DD]`: `{ food:[], workouts:[], steps:null, waterMl:null, weightKg:null, notes:"" }`.

Food: `{id,name,quantity,kcal,protein,carbs,fat,estimated,source,note}`. Nutrition units are kcal and grams; values may be null.

Workout: `{id,sessionId,name,status,durationMin,notes}`, with optional actual-exercise detail. `id` is mandatory. `sessionId` is either `null` for custom activity or a valid stored session ID. `durationMin` may be `null`.

Food and workout IDs must be unique within the same day because the validator checks them in one shared entry namespace. Never store aggregate totals as an independent source of truth; derive them from entries. Recipes contain batch `yieldG`, `total`, `per100g`, ingredient assumptions and notes.

## Working on the app

Static HTML/CSS/ES modules live in `dist/`; no install or bundle is required. `node scripts/serve.mjs --port 5173` is for ordinary local use; use the Sites supervised preview in its managed environment. Run `npm test` and `npm run validate` after behavior/schema changes. Browser tokens must remain in memory only and must never be committed, cached, logged or sent to any origin except GitHub's API. The data cache is a fallback, never a successful save. Preserve error/stale states and conflict handling.

The Sites manifest identifies the published static app. Read the Sites skills for app-source edits and redeploy after UI changes. GitHub remains the canonical source and data store. Commit source changes to GitHub as well as publishing. No database, server proxy, analytics, or background app process is needed.
