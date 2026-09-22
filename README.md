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
