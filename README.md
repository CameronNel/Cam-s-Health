# Cam’s Health

Food, body composition and workouts in a single, always-dark phone layout.

**App:** https://cams-health.cameronnel111.chatgpt.site

Three translucent liquid glass cards show the essentials. Hold a card (or tap it) to open a compact preview. Pinch out or use Expand for full-screen details; pinch in or Android Back returns to the preview. Each card’s + button opens its logging form. Settings contains tracking targets, units, GitHub editing authorization, exports and installation.

Food retains portions, calories, macros, estimates, recipe portions, repeats and corrections. Body retains dated weight, body fat, device-reported muscle, 13 tape measurements and graphs of actual readings. Workouts retain the prescribed rotation, actual sessions, exercises, durations and rest timer. Unknown values stay unknown.

Inbox, tasks, deliveries, facts, AI/handoff, check-ins and watch import are removed from the active interface. Historical data remains intact. The UI does not load the retired life modules or call their APIs.

Health records remain canonical on GitHub at `CameronNel/Cam-s-Health/main/dist/data/health.json`. The repository is public. Browser saves require a separate in-memory GitHub token; closing the tab drops it. Saves validate, use conflict checks and verify immutable commit content before reporting success.

## Development

Node 24 is recommended.

```sh
npm ci
npm test
npm run validate
npm run build
npm run dev -- --port 5173
```

The entry point is `dist/index.html`, loading `studio.js`, `studio.css` and `glass.css`. Persistence and validation use `sync.js`, `body.js`, `model.js` and `health-intelligence.js`. Read `AGENTS.md` before logging or changing health records. UI releases do not rewrite health.json. The existing Sites identity and audience are preserved.
