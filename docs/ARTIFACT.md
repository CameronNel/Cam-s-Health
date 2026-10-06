# Cam’s Life as a Claude Artifact

`artifact/` holds the Claude Artifact build of Cam’s Life. It runs inside claude.ai and uses the viewer’s own Claude subscription, so no API key or billing is needed.

- `npm run build:artifact` bundles `artifact/src/main.js` with the repository’s own validators (`dist/health-intelligence.js`, `dist/life-model.js`) into one file, `artifact/cams-life.html`.
- Capabilities: `sample` (Claude, including photos), `db` (private storage), `user`, `downloads`, and `mcp` for the claude.ai **Gmail** connector.
- Health records live in the Artifact database: `health/meta`, `health/sync` and one `days/YYYY-MM-DD` document per day. To-dos, packages, pickup codes and favourites live under the viewer-private `data/users/<id>/life`. Mailbox data never goes to GitHub.
- Claude only drafts changes. The app validates them with `validateLifeHealth`, shows a review, saves on one tap, reads the day back, and records the date in `health/sync.dirty`.

## Why GitHub is not written from the Artifact

Artifacts cannot make network calls and claude.ai has no GitHub connector, so the Artifact cannot commit `dist/data/health.json`. GitHub stays the canonical record through an explicit sync in Claude Code:

1. Read `health/sync` and export `health/meta` and `days` with `ArtifactData` (`out_dir`).
2. `node scripts/assemble-health.mjs <export dir> /tmp/health.json` rebuilds the file and runs `validateLifeHealth`.
3. Compare with `dist/data/health.json` on `main`. Preserve every existing entry and never overwrite a newer GitHub change.
4. Commit with `update_file` and the blob SHA, read it back, then set `health/sync.lastSyncedAt` and clear the synced `dirty` dates.

## Not possible on an Artifact

- Installing as an app with an icon, a manifest or a service worker. The Cloudflare PWA in `dist/` is unchanged.
- Hourly briefs or notifications. A page only runs while it is open.

## Gmail

The Gmail connector’s tool names could not be inspected from the build session, because that connector was not connected. `artifact/src/gmail.js` discovers tools at run time, but the published manifest names the tools it may call. If your connector uses different names, update `DECLARED_TOOLS` and `artifact/build.mjs` input to match what `listTools()` reports, then republish.
