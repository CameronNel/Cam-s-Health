# Cam’s Life

A personal workspace for health, inbox, deliveries, to-dos, and a sourced daily fact.

**Open the app:** https://cams-health.cameronnel111.chatgpt.site

Your existing health record remains at `dist/data/health.json` on `CameronNel/Cam-s-Health/main`. App releases preserve the latest canonical records and their history. Read `AGENTS.md` before logging through chat.

## The app

- **Today:** health totals, open tasks, expected packages and the daily fact.
- **Health:** existing food/recipes, calories/macros, water/steps, workouts/rotation, body measurements and exports. Optional check-ins add mood, energy, sleep, feelings and device-reported skeletal muscle. Trends use actual dates and known readings. Weight extrapolation requires five dates spanning at least a week; missing values stay unknown.
- **Inbox:** Gmail OAuth, a bounded mailbox scan, attention/noise classification, an action brief, delivery extraction, and reviewed archive/mark-read/Trash operations. Every mailbox change requires selecting exact messages and clicking confirm. There is no permanent-delete API.
- **Life:** durable private to-dos, deliveries and pickup/Cipio/PIN codes, pickup completion, and 20 source-linked facts with favorites.

The interface is phone-only and permanently dark: solid dark sage surfaces, cream text and restrained yellow accents, four thumb-reachable tabs with simple active underlines, readable charts, and Android-friendly bottom sheets. A larger screen keeps the same single-column phone layout. OS appearance and old light-theme preferences cannot switch the app to light. Settings, history, exports and sync diagnostics remain accessible from the header. Keyboard focus and reduced-motion support are retained.

## Install on your phone

Open the app in **Chrome on Android**, let it finish its first online load, then choose **Install app** from Chrome’s menu (some versions show **Add to Home screen → Install**). Settings also offers an install button when Chrome makes the native prompt available. Cam’s Life opens in a standalone portrait window with sage splash/theme colors and adaptive Android icons. Sites sign-in still applies; installation does not change who can access the app or authorize GitHub editing.

The service worker stores only digest-verified public app HTML, code, styles and icons. After a successful online health read, the existing validated health cache can be reviewed offline with a clear saved-copy warning. Private life/mailbox records, photos, tokens, API responses and health JSON are never added to the service-worker cache. Private records are unavailable on an offline fresh launch, rather than shown as zero tasks or packages. Saves and mailbox actions require a connection and are never queued or replayed.

New versions wait for **Review update → Reload app**. The app does not automatically reload unfinished forms or pending saves. Settings has a manual update check; `/update.html` offers recovery for older installed copies. The review explains what a reload clears; saved records remain intact. `npm run build` regenerates `dist/sw.js` from the public asset digests and worker template, then packages that exact release. Keep the Worker’s successful-app-shell header and root routing in place so online access/login failures cannot be replaced by an offline page.

## Health logging

Enter food name, portion, calories and macros in the food form. Label values and saved recipes can supply nutrition; unknown values stay unknown. Repeat a previous food or choose a saved recipe to reuse its recorded portion and values, then review before saving. Weight, body readings, water, steps, workouts and wellbeing have their own forms.

In-app AI, the Ask tab, model-based food estimates and the ChatGPT handoff have been removed at the owner’s request. Deprecated AI endpoints return a disabled response even for an older installed app, with no provider requests. The release removes only the app’s encrypted AI connection credential, preserving all saved meals, provenance, Gmail, life records and past request counts. The external Groq key is not revoked.

External chat logging through the connected GitHub repository remains available independently. The **Cam’s Life · hourly inbox brief** ChatGPT task is currently paused; its schedule is separate from in-app Gmail synchronization.

## Storage and privacy

Health uses the original GitHub store: fetch latest data, apply a minimal conflict-checked mutation, validate it, write with the blob SHA, and verify the immutable commit before reporting success. Browser GitHub tokens stay in memory and are sent only to GitHub. Local storage is a fallback cache with explicit stale/error states.

**The existing health repository is public.** Food, workouts and health check-ins committed there are public. The hosted app's owner-only access does not change repository visibility. Keep sensitive personal narrative and progress photos out of GitHub.

Tasks, delivery codes, favorites, mailbox metadata and encrypted Google refresh tokens use private, visitor-scoped D1 storage. APIs require Sites' trusted authenticated identity and exact same-origin checks for writes. State writes use version checks to prevent overwriting concurrent edits. No mailbox data is committed to the public repo. Google refresh tokens use AES-GCM with owner-bound authenticated data; reconnect/disconnect invalidates pending cleanup approvals.

## Gmail setup

Direct in-app Gmail scans require a Google OAuth web application. The ChatGPT Gmail connection is separate and cannot be copied into the app.

1. In [Google Cloud Console](https://console.cloud.google.com/projectcreate), create a project and enable Gmail API. No billing account is needed for Gmail API usage.
2. In Google Auth Platform, set the app branding/contact email. Use External / Testing, add your own Gmail address as a test user, and add the `gmail.modify` scope under Data Access.
3. Create a **Web application** OAuth client, including this exact authorized redirect URI: `https://cams-health.cameronnel111.chatgpt.site/api/inbox/callback`. Download its client JSON.
4. In **Settings → Set up Gmail**, import that JSON and save. The server verifies the client format and redirect, then encrypts the client settings with the existing `LIFE_ENCRYPTION_KEY` in owner-scoped private D1 storage. Nothing goes to GitHub or persistent browser storage.
5. Tap **Connect Gmail**, complete Google's consent, then scan. Importing the client is setup, not mailbox authorization. Test-mode refresh tokens expire after seven days, so Google may require reconnecting.

Deployment prerequisite: `LIFE_ENCRYPTION_KEY` remains a separate 32-byte base64url server secret. Existing server-managed `GOOGLE_CLIENT_ID` / secret `GOOGLE_CLIENT_SECRET` are still supported and take precedence; Settings cannot replace them. An already connected Settings client must be disconnected before replacement; existing tasks and deliveries remain intact. Google may require verification for broader distribution. This app remains owner-private.

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

`npm run build` emits the Cloudflare-compatible Worker and assets under `.sites-runtime/build` and mirrors them to ignored `dist/server` and `dist/client` for the Sites packager. Repeated builds exclude generated trees from source assets. Source schema lives in `db/schema.ts`; generate append-only production migrations with `npm run db:generate`. Sites owns the real D1 resource. Include `.openai/hosting.json`, `dist/server`, `dist/client`, and `drizzle` in the deployment archive. Never include local runtime state or secrets.

Verification covers retained health invariants, conflict handling, parser ambiguity, real-reading trends, mail extraction, owner isolation, encrypted OAuth, reviewed mailbox actions, preservation of completed tasks/deliveries, and service-worker access/update boundaries. Removal checks ensure cached AI requests make no provider calls and only AI credentials are removed by the migration. Browser checks cover the four phone tabs, manual forms, retained food provenance and an installed-app upgrade with saved history/preferences preserved. Production Gmail consent/reads/writes and physical Oppo installation remain unverified.

## Repository name

The product and package are named Cam’s Life. The GitHub repository remains `CameronNel/Cam-s-Health`: admin permission was confirmed, but this session's GitHub tool set has no repository-rename operation and the direct GitHub CLI API is unavailable. No repository or URL is assumed to have been renamed. If renamed later, update `REPO` in `dist/model.js`, documentation, token guidance and automation prompts together; preserve the original health data and GitHub redirects.

The mobile interface uses ambient dark sage backgrounds, translucent rounded tiles, a floating four-tab navigation capsule and a separate quick-log button. Nutrition rings and seven-day step bars come only from real records; missing readings stay unfilled. Motion respects the device’s reduced-motion setting.
