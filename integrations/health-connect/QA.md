# Watch integration verification

The tests and screenshots use synthetic browser fixtures and a separate, empty Android emulator. No physical Oppo, Galaxy Watch, Samsung account or personal Health Connect data was accessed. Real device authorization and watch-to-phone transfer remain unverified until the owner installs the companion and grants access.

## Import integrity

`node --test tests/watch-import.test.mjs` passes 14 tests. Coverage includes the existing schema and old records, absent versus zero readings, explicit replacements, duplicate imports, possible manual-workout duplicates, preservation of workout annotations and program associations, body-fat method disclosure, timezone validation, malformed and oversized files, concurrent changes and all-baselines-before-mutation behavior. Fixtures are synthetic. The browser must save through the existing compare-and-swap store and immutable-commit readback.

## Native artifact

- Source: `android/` in this directory; official Android 35 platform and build-tools 35.0.0, Android 14 minimum.
- Corrected signed APK SHA-256: `13cde29007d52ce641b45f4a6d3a5161d3e51619f6eb447aaa4adbf450e341af`.
- `apksigner verify` succeeds. `aapt2 dump permissions` reports exactly the six Health Connect read permissions for steps, hydration, weight, body fat, sleep and exercise.
- No Internet, write, background or history permission, service, local database, analytics or backup. Signing material is private and outside the repository.
- Actual Health Connect read/aggregate calls completed against the empty emulator. The result clearly says no supported readings were found and does not open a save picker or claim a successful export.

## Screenshot inspection

The builder inspected all 16 Samsung reference screenshots before native styling. The app uses a navy-to-amber backdrop, rounded charcoal cards, restrained sage controls and Android sans typography. The following actual emulator captures were inspected by the builder; independent reviewers receive the same files. Evidence is under `/tmp/cams-life/night-audit/`, and UI hierarchies/state metadata are in its `watch/` directory.

| Native state | Evidence |
| --- | --- |
| Corrected setup, 424 px, normal text | `native-watch-fixed-top-424.png`, `native-watch-fixed-inputs-424.png`, `native-watch-fixed-bottom-424.png` |
| Setup, 360 px, Android font scale 2.0 | `native-watch-top-360-200.png`, `native-watch-scroll1-360-200.png`, `native-watch-scroll2-360-200.png` |
| Corrected maximum setup scroll, 360 px / 200% | `native-watch-fixed-max-a-360-200.png`, `native-watch-fixed-max-b-360-200.png`; `watch/native-fixed-max-scroll-proof.json` |
| Date-range popup, normal and 200% text | `native-watch-date-range-424.png`, `native-watch-date-range-360-200.png` |
| Corrected focused timezone with actual native keyboard, 360 px / 200% | `native-watch-fixed-keyboard-360-200.png`; `watch/native-watch-fixed-keyboard-360-200.xml` |
| Actual empty SDK result | `native-watch-empty-read-424.png`; `watch/native-empty-layout.xml` |
| Actual Health Connect read-permission request, all six types visible, no grants approved | `native-watch-permission-types-424.png`, `native-watch-permission-final-bottom-424.png`; `watch/native-permission-final-bottom.xml` |
| Denied permission result and disabled export | `native-watch-no-types-final-424.png`; `watch/native-no-types-final.xml` |
| Privacy, 424 px, normal text | `native-watch-privacy-top-424.png`, `native-watch-privacy-bottom-424.png` |
| Privacy, 360 × 800 px / 200% text, full scroll | `native-watch-privacy-top-360-800-200.png`, `native-watch-privacy-scroll1-360-800-200.png`, `native-watch-privacy-scroll2-360-800-200.png`, `native-watch-privacy-scroll3-360-800-200.png`, `native-watch-privacy-max-a-360-800-200.png`, `native-watch-privacy-max-b-360-800-200.png`; `watch/native-privacy-max-scroll-proof.json` |

For maximum-scroll proof, a fresh setup activity received ten upward swipes, then three further swipes. Application text and node bounds remained identical. Both section-four paragraphs are visible in full. The final Privacy button ends at y=704; Android navigation starts at y=752, leaving 48 pixels clear. UIAutomator does not expose `scrollY` or `maxScrollY`, so the metadata records those as unavailable rather than inventing them.

The independent setup reviewer found that the default Android timezone input measured only 43 pixels high at normal text. Its minimum height was corrected to 48 dp, and the signed APK was rebuilt and installed for fresh setup, focused-keyboard and maximum-scroll screenshots. This correction only touches `MainActivity`; the privacy screen and permission request are unchanged. Their previous actual captures remain explicitly attributed to the previous APK in their metadata rather than being claimed as captures from the corrected artifact.

The date-range popup was opened, dismissed through Android Back, reopened at enlarged text, dismissed again and followed by timezone focus. No extra app menu remained open. In the corrected artifact, the focused timezone ends at y=389, above the native keyboard beginning at y=489. All seven switches (Allow all plus six types) stayed off in the permission-request audit; only the system's first-run tutorial was advanced, and the request was denied. Steps ends at y=741 and Weight at y=801, above the system list boundary y=817. Earlier virtual read grants used to exercise the empty SDK were revoked before this permission audit. Repeated denials caused Android to suppress another request; only the isolated emulator's denial flags were cleared to capture the complete list again, without approving any grant.

The emulator uses software rendering and CPU emulation. Initial launcher/SystemUI startup produced system ANRs; test-only `hide_error_dialogs=1` suppressed those emulator infrastructure alerts. Health Connect's first cold permission window also appeared transiently blank; the warm retry displayed the actual tutorial and six-type request. These observations are not claimed as physical-device performance validation. Android owns its permission page and keyboard theme; the companion's own screens always use its dark theme.
