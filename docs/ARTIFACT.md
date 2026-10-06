# Cam’s Life as a Claude Artifact

`artifact/` holds the Claude Artifact build of Cam’s Life. It runs inside claude.ai and uses the viewer’s own Claude subscription, so no API key or billing is needed.

- `npm run build:artifact` bundles `artifact/src/main.js` with the repository’s own validators (`dist/health-intelligence.js`, `dist/life-model.js`) into one file, `artifact/cams-life.html`.
- Capabilities: `sample` (Claude, including photos), `db` (private storage), `user`, `downloads`, and `mcp` for the claude.ai **Gmail** connector.
- Health records live in the Artifact database: `health/meta`, `health/sync` and one `days/YYYY-MM-DD` document per day. To-dos, packages, pickup codes and favourites live under the viewer-private `data/users/<id>/life`. Mailbox data never goes to GitHub.
- Claude only drafts changes. The app validates them with `validateLifeHealth`, shows a review, saves on one tap, reads the day back, and records the date in `health/sync.dirty`.

## GitHub stays canonical: hourly two-way sync

Artifacts cannot make network calls and claude.ai has no GitHub connector, so the Artifact cannot commit by itself. A scheduled Claude Code routine does it every hour:

1. Export `health/meta`, `health/sync` and `days` from the Artifact database (`ArtifactData`, `out_dir`).
2. `git show <baselineCommit>:dist/data/health.json` is the last synced state; `origin/main` is GitHub's current state.
3. `node scripts/sync-health.mjs --base … --github … --artifact-dir … --out … --artifact-out … --report …` merges all three. Entries merge by id, so meals logged through chat on GitHub and meals logged in the app both survive. A true conflict (the same entry edited in both places) keeps the GitHub value and is reported. Nothing is deleted unless the other side left that entry untouched. The result must pass `validateLifeHealth`.
4. If GitHub changed, commit `dist/data/health.json` to `main`, verify it, and read it back. If the app is behind, write the merged days back to the Artifact database with version pins.
5. Update `health/sync` (`baselineCommit`, `lastSyncedAt`) and clear only the `dirty` dates that were synced.

Mail, to-dos, packages and pickup codes live under the viewer-private `data/users/<id>/life` path and are never exported or committed.

## Not possible on an Artifact

- Installing as an app with an icon, a manifest or a service worker. The Cloudflare PWA in `dist/` is unchanged.
- Hourly briefs or notifications. A page only runs while it is open.

## Gmail

The Artifact calls the claude.ai **Gmail** connector as the signed-in viewer, so no Google Cloud project is needed. Four tools are declared in the manifest and checked against the connector's real schemas: `search_threads`, `get_thread`, `unlabel_thread` and `trash_thread`. Search returns thread ids, so every change is thread-level. Archive removes `INBOX`, Mark read removes `UNREAD`, and Trash moves the thread to Trash, where Gmail keeps it for 30 days. The app never sends, forwards, drafts or permanently deletes mail. Claude can only search and read. Changes run from buttons after you select exact threads and tap twice. Delivery codes and tracking numbers are kept only when they appear verbatim in mail Claude read. If the connector's tool names change, update `DECLARED_TOOLS` in `artifact/src/gmail.js` and the capabilities passed when publishing. `tests/artifact-gmail.test.mjs` pins the call shapes.
