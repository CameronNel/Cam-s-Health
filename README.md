# Cam’s Health

A static fitness tracker. GitHub is the source of truth. No application backend, database, or AI key is required.

The canonical record is `dist/data/health.json`. Read `AGENTS.md` before logging through chat. This repository is public; records committed here are public too.

**Open the app:** https://cams-health.cameronnel111.chatgpt.site

## Use it

Tell ChatGPT what you ate, your step total or what you trained. With this repository's GitHub connection, it reads the latest record, commits your update, and replies with daily totals. In a new conversation, share this repo and ask it to read `AGENTS.md`. The app retrieves the updated JSON directly from GitHub; no redeployment is required for food/activity changes.

- Daily calories, macros, step goal, water and body weight.
- Food records with quantities, estimates, correction and deletion.
- Portion logging from saved recipes.
- Existing Push/Pull/Legs A/B rotation, rest, exercise prescriptions, completed sessions and durations.
- Date navigation, history, daily brief, print/PDF and JSON export.
- Refresh on opening, returning to the tab, every five minutes, or manually.
- Optional direct editing with a fine-grained GitHub token for this repo, Contents: Read and write. The token stays in memory for the current tab and is never stored or embedded. Chat logging needs no token in the app.

## Mobile experience

The app is designed for phones first. Home combines daily nutrition, activity tiles and compact food/workout summaries. Tap a meal for its nutrition and source notes. Tap a workout for the full prescription, or hold for 450 ms to preview; moving your finger cancels the hold so scrolling stays natural. An eye button provides the same preview without a gesture.

Detail pages support Back navigation, preview/form sheets support dismissal, and dates have a Today reset. Log again prefills a repeated meal for review before saving. Background refresh leaves active forms alone. The seven-day chart lives in History rather than crowding Home.

## Data integrity rules

**Do not hand-write tracker records loosely.** The live app validates `dist/data/health.json` before accepting it. A structurally invalid record makes the app reject the new GitHub data and fall back to an older cached copy.

For every chat-driven data write:

- Read the latest `dist/data/health.json` and its blob SHA first.
- Every food entry must have a unique non-empty `id`.
- **Every workout entry must also have a unique non-empty `id`**, including custom or partial workouts. Workout IDs must not collide with food IDs on the same day.
- A workout uses `{id, sessionId, name, status, durationMin, notes}`; `sessionId` is `null` for custom activity or a valid stored session ID. Unknown duration is `null`, never invented.
- Treat `dist/model.js -> validate()` as the schema contract. If that validator would reject the JSON, do not commit it.
- After every successful write, fetch `dist/data/health.json` again and verify the intended record and recalculated totals before saying it was saved.
- If the app shows an “Invalid or duplicate …” warning, inspect the newest JSON for missing IDs or duplicate IDs before blaming cache or deployment.

The September 22, 2026 stale-calorie bug was caused by custom workout records missing `id`; GitHub contained the food updates, but the app correctly rejected the invalid file and displayed its last valid cached copy. Do not repeat this failure mode.

## Persistence and limits

GitHub JSON plus commit history are persistent storage. Local storage only caches the last read for connection failures, with a stale-data warning. Saves re-read the current file, preserve unrelated records, and use the GitHub blob SHA to detect concurrent updates. No AI runs inside the static app; conversational interpretation happens in ChatGPT. Nothing automatically tracks a phone/watch, and unknown activity stays unlogged. Nutrition estimates are not laboratory measurements.

The hosted app is owner-private; the GitHub repository and its committed records are public. Changing the app audience does not change repository visibility. If you make the repository private, browser reading needs an authorized GitHub token and historical public exposure is not undone.

The first import contains the four actual September 22 food records and current Notion targets/program. No workout completion, steps or measurements were invented. The mini-meatball nutrition inconsistency is flagged for review. GitHub becomes the active tracker; Notion is not automatically kept in sync.

## Development / alternate hosting

```sh
npm run dev -- --port 5173
npm test
npm run validate
```

There are no package dependencies or build step. Serve the `dist/` directory on any static host. It can also be published with GitHub Pages using an Actions workflow that uploads `dist/`, after enabling Pages in repository settings. No server, API key or database needs to be deployed. UI source changes require publishing the static files; data updates do not.
