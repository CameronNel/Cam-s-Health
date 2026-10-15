# Cam’s Health

Food, body composition and workouts in a single, always-dark phone layout.

**App:** https://cams-health.cameronnel111.chatgpt.site

Three optical-glass widgets show Food, Body comp and Workouts over an obsidian background. Clear silver rims, an opal glass sculpture rendered in WebGL and source-to-popup morphing provide depth without obscuring the data. The glass renderer pauses offscreen and under reduced motion and has a CSS fallback. Hold or tap a widget for a compact preview; pinch out or use Expand for full-screen details. Pinch in or Android Back returns to the preview. Widget + buttons and Log open the existing forms. Settings contains appearance, widget order and size, glass clarity, four palettes, targets, units, recoverable drafts, GitHub authorization, exports and installation.

If an installed copy still shows the previous design, use Settings → Check for updates → Apply app update, or open `/update.html`. Updates preserve saved records and require an explicit reload.

Food studio adds a local food library, barcode lookup/camera, on-device label OCR, favourite portions, meal templates, recipe versions, planned meals, nutrition review, meal groups and training/rest targets. Body studio adds quick weigh-ins, a measurement map, comparisons, smoothed weight trends, goal bands, method filters, chart notes, pinned metrics, optional reminders and reviewed CSV imports.

Workout studio records individual performed sets, previous results, warm-ups, RIR/RPE, supersets, set-linked rest and chosen substitutions. Records, weekly volume and user-defined progression milestones derive from actual performance. Movement demos preload and support camera angles, side mirroring, scrubbing, speed and projected joint paths. Unknown values stay unknown.

One-step undo preserves unrelated newer changes. Local unfinished entries reopen for explicit review; they never auto-submit. Label images remain on the device. Large OCR libraries load only when used. Calendar reminders can work through the calendar app; browser alerts require the tracker to be open. The [50-feature coverage ledger](docs/TRACKER-EXPANSION.md) records scope and verification.

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
