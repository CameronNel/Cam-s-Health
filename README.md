# Cam’s Life

A personal workspace for health, inbox, deliveries, to-dos, and a sourced daily fact.

**Open the app:** https://cams-health.cameronnel111.chatgpt.site

Your existing health record remains at `dist/data/health.json` on `CameronNel/Cam-s-Health/main`. This overhaul does not alter that file or its history. Read `AGENTS.md` before logging through chat.

## The app

- **Today:** health totals, open tasks, expected packages and the daily fact.
- **Health:** existing food/recipes, calories/macros, water/steps, workouts/rotation, body measurements and exports. Optional check-ins add mood, energy, sleep, feelings and device-reported skeletal muscle. Trends use actual dates and known readings. Weight extrapolation requires five dates spanning at least a week; missing values stay unknown.
- **Inbox:** Gmail OAuth, a bounded mailbox scan, attention/noise classification, an action brief, delivery extraction, and reviewed archive/mark-read/Trash operations. Every mailbox change requires selecting exact messages and clicking confirm. There is no permanent-delete API.
- **Life:** durable private to-dos, deliveries and pickup/Cipio/PIN codes, pickup completion, and 20 source-linked facts with favorites.
- **Ask:** free, deterministic parsing of explicit check-ins, followed by review and a verified GitHub save. Deeper questions, meal interpretation and photo analysis use a copy-and-open ChatGPT handoff with the user's existing subscription. Photos stay in the current tab and are not uploaded or stored by this app.

The interface is phone-only and permanently dark: solid dark sage surfaces, cream text and restrained yellow accents, five thumb-reachable tabs with simple active underlines, readable charts, and Android-friendly bottom sheets. A larger screen keeps the same single-column phone layout. OS appearance and old light-theme preferences cannot switch the app to light. Settings, history, exports and sync diagnostics remain accessible from the header. Keyboard focus and reduced-motion support are retained.

## No paid AI requirement

A ChatGPT subscription does not include OpenAI API credits or an API that can be embedded in this app. The release makes no OpenAI API calls and requires no OpenAI key. Local parsing is explicitly labelled; it does not pretend to be ChatGPT. The ChatGPT handoff requires a copy/paste step and an existing GitHub connection to update the health record. Refresh the app after ChatGPT saves.

An enabled **Cam’s Life · hourly inbox brief** ChatGPT task scans the connected Gmail mailbox hourly in Europe/Amsterdam and notifies on meaningful new actions/delivery changes. Its briefs arrive in ChatGPT, not automatically in the app's D1 inbox state. Creating the task does not prove that its first run has completed. Existing paused fitness tasks remain paused.

## Storage and privacy

Health uses the original GitHub store: fetch latest data, apply a minimal conflict-checked mutation, validate it, write with the blob SHA, and verify the immutable commit before reporting success. Browser GitHub tokens stay in memory and are sent only to GitHub. Local storage is a fallback cache with explicit stale/error states.

**The existing health repository is public.** Food, workouts and health check-ins committed there are public. The hosted app's owner-only access does not change repository visibility. Keep sensitive personal narrative and progress photos out of GitHub.

Tasks, delivery codes, favorites, mailbox metadata and encrypted Google refresh tokens use private, visitor-scoped D1 storage. APIs require Sites' trusted authenticated identity and exact same-origin checks for writes. State writes use version checks to prevent overwriting concurrent edits. No mailbox data is committed to the public repo. Google refresh tokens use AES-GCM with owner-bound authenticated data; reconnect/disconnect invalidates pending cleanup approvals.

## Gmail setup

Direct in-app Gmail scans require a Google OAuth web application. The ChatGPT Gmail connection is separate and cannot be copied into the app.

1. In [Google Cloud Console](https://console.cloud.google.com/), enable Gmail API, configure the OAuth consent screen, add your own Google account as a test user when appropriate, and create a Web application OAuth client.
2. Add this exact authorized redirect URI: `https://cams-health.cameronnel111.chatgpt.site/api/inbox/callback`.
3. Configure `GOOGLE_CLIENT_ID` and secret `GOOGLE_CLIENT_SECRET` as Sites runtime values. `LIFE_ENCRYPTION_KEY` is a separate 32-byte base64url server secret; never commit it. A local `.env.example` lists names only.
4. Redeploy the saved app version so runtime changes take effect, then use **Inbox → Connect Gmail**. The requested scope is `gmail.modify`, supporting reads and reviewed recoverable actions. Google may require verification for broader distribution. This app remains owner-private.

Gmail sign-in has clear unavailable/error states until those values exist. No user mailbox is read or modified during build/tests. Direct server-hourly sync remains disabled: the exported scheduled entry needs an actual configured and verified scheduler, not just a browser timer or environment flag. The subscription-based task above runs independently.

## Development

Requires Node >=22.13; Node 24 is recommended for the SQLite-backed backend tests.

```sh
npm ci
npm test
npm run validate
npm run dev:life -- --port 5173
npm run build
```

`dev:life` serves loopback only and uses `.sites-runtime/life-dev.sqlite`. Its mock identity is local-only and never part of the Worker build. The original `npm run dev` remains a static-health preview.

`npm run build` emits the Cloudflare-compatible Worker and assets under `.sites-runtime/build`. Source schema lives in `db/schema.ts`; generate append-only production migrations with `npm run db:generate`. Sites owns the real D1 resource. Include `.openai/hosting.json`, `dist/server`, `dist/client`, and `drizzle` in the deployment archive. Never include local runtime state or secrets.

Verification: 118 meaningful regression checks cover retained health invariants, conflict handling, parser ambiguity, real-reading trends, mail extraction, owner isolation, encrypted OAuth, reviewed single-use mailbox actions, and preservation of completed tasks/deliveries. Touch-browser checks at 424, 390 and 360 CSS pixels verify the dark lock, navigation, Settings/History access, chart routes, check-in review and measurement sheets. Production Gmail consent/reads/writes remain unverified until Google setup is completed.

## Repository name

The product and package are named Cam’s Life. The GitHub repository remains `CameronNel/Cam-s-Health`: admin permission was confirmed, but this session's GitHub tool set has no repository-rename operation and the direct GitHub CLI API is unavailable. No repository or URL is assumed to have been renamed. If renamed later, update `REPO` in `dist/model.js`, documentation, token guidance and automation prompts together; preserve the original health data and GitHub redirects.
