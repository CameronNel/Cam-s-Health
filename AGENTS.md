# Cam’s Life: persistent health logging and private life workflows

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
7. Fetch current file content and blob SHA, apply the minimal mutation, update `updatedAt`, and run `npm run validate` against the result before writing. The active contract is `dist/health-intelligence.js -> validateLifeHealth()`, which wraps `dist/body.js -> validateHealth()` and the original model validator. JSON parsing alone is not schema validation. Missing or duplicate entry IDs are fatal because the app will reject the entire newer file and display an older cached copy. Then write with GitHub `update_file` using that SHA. If the SHA conflicts, fetch again and reapply only the requested change. Never force overwrite. If an edit to the same record conflicts semantically, show the conflict instead of silently replacing it. A create for a genuinely absent path uses create_file. If execution is unavailable, explicitly validate all relevant constraints and state that executable validation was not run; do not claim it was.
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

The user requires **always dark mode and mobile only**, using an Oppo Find X9 Pro. Preserve the dark sage green, cream and restrained yellow palette, flat surfaces, simple typography and single-column phone layout at every viewport. Do not reintroduce a light/system appearance option or desktop sidebar. Verify readable charts, 44px touch targets, small-phone forms and Android keyboard spacing when changing the UI.

The app is a PWA. Keep its manifest/standalone icons and sage startup colors. `npm run build` must regenerate the digest-pinned service worker after changing a public shell file or its template. Never cache private API/mailbox responses, tokens, photos, health JSON or auth pages in CacheStorage; health uses its existing validated localStorage fallback. Preserve the Worker’s successful-shell marker and canonical-root routing. Updates wait for an explicit reviewed reload, and offline writes are never queued/replayed. Show unavailable private records as unknown, not zero.

The browser HTML/CSS/ES modules live in `dist/`. The private life/Gmail backend is `server/worker.mjs`; `npm ci` and `npm run build` prepare a Worker deployment. The existing health file stays on GitHub. `node scripts/serve.mjs --port 5173` is for ordinary local use; use the Sites supervised preview in its managed environment. Run `npm test` and `npm run validate` after behavior/schema changes and validate the actual candidate health JSON before data commits. Browser tokens must remain in memory only and must never be committed, cached, logged or sent to any origin except GitHub's API. The data cache is a fallback, never a successful save. Preserve error/stale states and conflict handling.

The Cam’s Life entry point loads `studio.js`, `studio.css`, `life-ui.js` and `life.css`; health validation/persistence use `health-intelligence.js`, `body.js` and `sync.js`. Legacy files remain for reference. Do not patch only the unused legacy `app.js` and expect the new UI to change.

The Sites manifest identifies the published Worker app. Read the Sites skills when available and redeploy after UI changes. GitHub remains the canonical source and data store. Commit source changes to GitHub as well as publishing. Only health data belongs in the existing GitHub file. Private to-dos, deliveries, mailbox metadata and favorites use the Sites D1 LIFE_DB binding; never commit them or OAuth secrets to GitHub. No paid OpenAI API is used. The Ask tab parses explicit facts locally and hands deeper/photo requests to the user’s existing ChatGPT subscription. Hourly Gmail briefs are a separately saved ChatGPT task, not proof of app-side sync. The Studio 02 build session had no Sites publisher, so hosted deployment was not verified. Never claim the new UI is live until a publishing action succeeds and the deployed build is checked.

Only digest-verified public shell HTML may be cached; authenticated/personalized HTML, login and permission pages never enter CacheStorage. Keep the optional ChatGPT conversation/project URL explicitly device-local; opening/copying the handoff is not submission or a completed save. Embedded ChatGPT plan usage for remotely hosted apps requires separate access approval; do not reuse session credentials or fall back to billed APIs.

The Tracker integrity workflow checks syntax, tests and the actual committed data. Without branch protection it does not prevent direct bad commits or repair them automatically. Keep the missing-workout-ID regression tests. Test fixtures must remain isolated from `dist/data/health.json` on main.

## Cam’s Life optional check-ins

Keep schemaVersion:1 and all legacy fields. Optional `day.wellbeing` contains `{mood,energy,sleepHours,feelings}`. Mood/energy are integers 1..5 or null; sleep is 0..24 hours or null; feelings are text up to 2000 characters. Do not infer a score from arbitrary feelings. A disclosed named scale may be explicitly chosen in app. Optional `day.body.skeletalMuscleKg` is a reported device reading, greater than 0 and at most 300 kg, and cannot exceed same-day weight when both are known. It is distinct from derived fat-free mass. Keep measurement method/uncertainty and unrelated circumference fields intact. Use `validateLifeHealth` for all candidate files, including read-back.

The release does not rewrite health.json. Do not log the illustrative values in the UI or this request. Do not infer body fat/muscle from photos. No photos are stored by the app. Direct browser health edits still require the in-memory GitHub token, while chat logging uses the GitHub connector. Never put mailbox data or pickup codes in this public record.

In-app meal lookup uses `food-lookup.js` and the pinned public USDA reference module `food-catalog.js`; see `docs/FOOD-LOOKUP.md`. Preserve distinct raw/cooked matches, explicit portions, unknown nutrients, source/assumption notes and stable draft IDs. Never describe lookup as ChatGPT inference. Food cards and the normal food form share nutrition scaling. Failed saves retain the draft; GitHub's verified persistence and editing authorization still apply. Rebuild the PWA after changing either public module.

Gmail setup is available in Settings. Google Cloud project creation/consent requires the user’s Google account; do not claim that an imported OAuth client is mailbox authorization. `mailbox_oauth_clients` stores per-owner client settings encrypted with a distinct `oauth-client:<owner>` authenticated context and the existing server encryption key. Client JSON is never persisted in browser storage, public GitHub, logs or API responses. Preserve server-managed OAuth client precedence and block replacement while Gmail is connected. Validate the exact redirect URI, invalidate pending OAuth states on a settings change, and retain all life history. The append-only D1 migration must ship with the Worker. ChatGPT opens separately: the app must never present the local lookup or a handoff as an embedded ChatGPT connection.

The user explicitly requires a real AI model for natural-language meal interpretation and rejects lookup as a substitute. Provider selection is pending (free hosted model, on-device model, or approved ChatGPT plan access). Do not claim local parsing or food lookup fulfills that requirement, create paid API access, or substitute a different model without resolving that choice.
