# Galaxy Watch → Cam’s Life

This integration uses the free Android Health Connect platform. It does not use a paid service, a Samsung developer account, an AI API or a cloud mailbox connection. The watch first synchronizes with Samsung Health on the Android phone. Samsung Health shares allowed types with Health Connect. A small read-only Android companion exports those types to a file; Cam’s Life previews and saves only the readings the user selects.

**Status:** 14 import integrity tests pass and the signed companion is built against the official Android 35 platform. Its actual Health Connect read calls and truthful empty-data result were exercised on an isolated Android 15 emulator. Setup, privacy, enlarged text, keyboard and date-range menus were inspected from screenshots. Actual Oppo/Galaxy Watch authorization and data transfer require installation and health permissions on the user’s phone. Do not describe the watch as connected before those steps succeed. This is a reviewed file transfer, not automatic or background synchronization.

## Phone setup

1. Install the Cam’s Life Watch companion on Android 14 or later. This release is a privately signed sideload build, not a Google Play release. Android may ask for permission to install from the chosen browser/file manager.
2. Update Samsung Health on the phone and watch. Open Samsung Health → Settings → Health Connect → App permissions → Samsung Health. Allow sharing for the desired supported readings. Open the Samsung Health home screen and synchronize the watch. Samsung’s own sync policy controls when watch readings arrive.
3. Open **Cam’s Life · Watch** and choose Health Connect read access. Denied/revoked types remain absent; the companion has no write permissions. Use `Europe/Amsterdam` to match Cam’s Life’s current profile. Export seven or thirty calendar days and save the JSON on the phone.
4. Open Cam’s Life → Settings → Watch & Samsung Health. Choose that JSON export. Review the readings, explicitly select any replacements, and authorize the existing GitHub save. The save is checked against a fresh file and verified by reading the immutable commit. The source health repository is public; accepted readings become public there.

The companion has no `INTERNET` permission, background service, account, stored token, analytics, local database or backup. Only the selected export file persists. Revoking permissions or uninstalling it does not remove Samsung Health, Health Connect, Cam’s Life records or previously exported files. A file location selected through Android can belong to another app; choose local phone storage for health exports.

## Supported readings and limits

| Reading | Mapping and integrity rule |
| --- | --- |
| Steps | Health Connect aggregate count for the selected local calendar day. Uses platform aggregation rather than adding overlapping raw phone/watch intervals. Replaces a reviewed daily total; never increments it. |
| Water | Health Connect hydration aggregate in ml. Availability depends on what Samsung Health or another allowed app actually shares. Missing data is omitted. |
| Weight | Latest actual reading per date, in kg. Existing different measurements require review. |
| Body fat | Latest actual percentage per date. Health Connect does not expose its measurement method. The preview discloses `Not specified`; accepting it changes that date’s body-fat method accordingly while retaining muscle, circumference and notes. |
| Sleep | Known asleep stages, merged to avoid overlapping intervals, attributed to the wake date. Samsung Health is preferred when present. Missing stages, unknown stages or uncovered session intervals over one minute cause that date’s sleep reading to be omitted. Time in bed is never passed off as sleep. |
| Workouts | Recorded interval and title, with stable Health Connect record ID and source. Imports as a custom completed recording with `sessionId:null`; never advances the prescribed rotation or invents sets, load or repetitions. If another workout already exists on that date, the import requires review for possible duplication. |

Skeletal muscle is not a Health Connect record type. Lean body mass is not skeletal muscle and is not substituted. Food, heart rate, blood oxygen, ECG, blood pressure, calorie expenditure and Samsung energy/sleep scores are outside this first import contract; existing records remain intact. They are not silently discarded from an imported file: unsupported fields cause a clear error. Raw Samsung personal-data CSV/ZIP exports are deliberately not parsed without a documented, validated format/sample.

This companion reads in the foreground only and requests no history or background privileges. Health Connect generally permits the thirty days before initial permission grant; longer history needs an additional user permission and a future version. No export is silently uploaded. The PWA cannot request Android Health Connect permissions itself, and installing the PWA does not give it native device access.

The companion rounds numeric exports to three decimal places. Individual reading and workout timestamps and record identifiers remain intact. Weight is therefore exported to the nearest gram; this does not infer the accuracy of the original device. Step and water aggregates use a descriptive per-date aggregate identifier and the export time, because the platform aggregate response supplies source app packages rather than individual raw record IDs or measurement timestamps.

## Browser integration contract

Module: `dist/integrations/watch-import.js`.

```js
const reviewed = prepareWatchImport(store.data, await selectedFile.text());
// Render every change; use reviewed.selectedKeys for defaults (only new readings).
// Warn that conflicting readings replace existing values and workouts may duplicate a manual log.
const selected = prepareWatchImport(store.data, reviewed.bundle, {selectedKeys});
if (!selected.accepted.length) return; // never mark an empty save as a successful import
await store.save(selected.apply, 'Import reviewed Health Connect readings');
```

Each change supplies `key`, `date`, `kind`, `label`, `unit`, `before`, `value`, `status` (`new`, `same`, `conflict`) and `source`. Escape imported text in HTML. Status `same` is a no-op, conflicts default to unselected, and selection never changes the source data during preview. The proposal checks all baselines before applying any mutation, preserves unrelated concurrent changes, validates the complete candidate, and leaves `updatedAt` to the existing GitHub store. Source packages, record IDs, original timestamps and actual import time are retained under optional `day.healthConnect`; imported workout source metadata is retained on the entry. Those additions remain backward compatible with schema version 1.

Import files are limited to 2 MB and 31 distinct calendar dates. Timezone must match the app profile; dates are never silently shifted. The parser is strict and allows only the companion version-1 envelope. Do not cache files, Health Connect data, exports or the APK in CacheStorage. Only the public JS module belongs in the PWA shell asset list.

## Build

The release download is `dist/integrations/cams-life-watch.apk` (package `com.camslife.healthbridge`, version 1.0). SHA-256: `13cde29007d52ce641b45f4a6d3a5161d3e51619f6eb447aaa4adbf450e341af`. The signing key stays outside the repository. Source changes require a rebuilt, signed APK and updated digest before publication.

Use official Android SDK platform 35 and build-tools 35.0.0 plus a JDK with `jdk.compiler`. Dependencies are not installed globally. `android/build.sh` compiles Java, builds DEX/resources, aligns the APK, and optionally signs it using an explicit private key/password file. No key is copied into the app, repository or export.

```sh
CAMS_ANDROID_PLATFORM=/path/to/sdk/platforms/android-35 \
CAMS_ANDROID_BUILD_TOOLS=/path/to/sdk/build-tools/35.0.0 \
CAMS_WATCH_BUILD_DIR=/tmp/cams-life-watch-build \
CAMS_WATCH_SIGNING_KEY=/private/watch-release.keystore \
CAMS_WATCH_SIGNING_PASSWORD_FILE=/private/watch-signing-password \
bash integrations/health-connect/android/build.sh
```

Retain the private signing key securely to update the installed APK later. If a future build uses a different signature, Android requires uninstalling the companion first; no health data lives in the companion. Production store distribution would also require Health Connect’s Google Play health declaration and a published privacy policy. Direct Samsung Health Data SDK distribution is a different route and requires Samsung partner approval; this companion does not use it.

## Primary sources checked 6 October 2026

- [Samsung Health Connect FAQ](https://developer.samsung.com/health/health-connect-faq.html): watch-to-phone-to-Health-Connect flow, permissions, sync timing and troubleshooting.
- [Samsung: accessing Samsung Health through Health Connect](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect): supported synchronization, data scope and Samsung Health setup.
- [Android Health Connect setup](https://developer.android.com/health-and-fitness/health-connect/get-started): native SDK/device permissions, permission revocation, cumulative aggregation, history restrictions and privacy rationale.
- [Android HealthConnectManager API](https://developer.android.com/reference/android/health/connect/HealthConnectManager): platform API used by this Android 14+ companion.
- [Samsung Health Data SDK app verification](https://developer.samsung.com/health/data/guide/app-verification.html): partner approval applies to Samsung’s direct SDK, not this Health Connect route.

No Samsung Health or Health Connect plugin was returned by the plugin-directory search. That search is not evidence that no future plugin can exist.
