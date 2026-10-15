# Layout audit

Run from the repository root with Node 24, Chromium and Playwright available. The harness tries the local `playwright` package, then the managed runtime. It uses `/usr/bin/chromium` by default. Start the app on port5173:

```sh
npm ci
npm run build
npm run dev -- --port 5173
```

In another terminal, run each domain script. They use synthetic fixtures, intercept GitHub writes, and never submit health records to the network:

```sh
node scripts/audit/inventory.mjs
node scripts/audit/food.mjs
node scripts/audit/body.mjs
node scripts/audit/workouts.mjs
AUDIT_SHELL_OUT=/workspace/cams-health-layout-audit/shell-final-v3 node scripts/audit/shell.mjs
node scripts/audit/system.mjs
AUDIT_ACCESSIBILITY_DOMAIN=accessibility-final node scripts/audit/accessibility.mjs
AUDIT_GALLERY_ONLY=1 AUDIT_OUT=/workspace/cams-health-layout-audit/movements-final/native-gallery node scripts/audit/movements.mjs
AUDIT_RESPONSIVE_ONLY=1 AUDIT_OUT=/workspace/cams-health-layout-audit/movements-final/responsive node scripts/audit/movements.mjs
AUDIT_OUT=/workspace/cams-health-layout-audit/movements-final/lifecycle node scripts/audit/movement-lifecycle.mjs
node scripts/audit/pwa.mjs
```

Movement scripts also expose separate gallery, responsive and lifecycle phases; inspect their `AUDIT_GALLERY_ONLY`, `AUDIT_RESPONSIVE_ONLY` and `AUDIT_LIFECYCLE_PHASE` switches before running a focused retest. The artifact default is `/workspace/cams-health-layout-audit`. Per-domain output overrides and scoped-state switches are declared at the top of each script. `AUDIT_METRICS_ONLY=1` skips PNG captures without skipping layout checks. Run a build before PWA tests because service-worker asset digests must match the static sources.

The separately scoped Light movement gallery uses `AUDIT_GALLERY_REPRESENTATIVES_ONLY=1` with `AUDIT_GALLERY_ONLY=1`, `AUDIT_THEME=light` and `AUDIT_OUT=/workspace/cams-health-layout-audit/movements-final/light-native-gallery`. It requests 59 whole-phone demo/variant PNGs, 236 primary popup/full folded/options cases and 59 default-camera states with 472 sampled poses. Its counts do not replace the historical 488-image, 304-camera-state, 2,432-pose Dark baseline. The final source projection stress test is a separate artifact from either rendered gallery.

After every production fix, freeze the UI source and rerun final evidence in fresh browser contexts. `sourceFingerprint()` records all active top-level JS/CSS/HTML except the generated service worker; each screen also records whether source changed since boot. A staged audit may retain a source-labelled native baseline, then apply a reviewed selector-scoped repair batch and run the full geometry matrix on the final source. Preserve original hashes and images; recapture every affected view natively. Register baseline policy and explicit repair ledgers in `source-policy.json`. Count baseline pixels, current pixels and current geometry separately; never relabel an older capture or silently claim it rendered the final code.

```sh
node scripts/audit/reconcile.mjs
node scripts/audit/report.mjs
```

The reconciler checks independent expected-state plans, profile/mode combinations, actual DPR and viewport, native PNG dimensions, source identity, geometry flags, focused fields and failed checks. It accepts only explicitly final ledgers for route-family evidence. The report creates a searchable local HTML case table and screenshot gallery. Geometry, full-page PNGs, stage crops, projected movement coordinates and actual visual review remain separate evidence.

Set `AUDIT_THEME=dark` or `AUDIT_THEME=light` for a theme run. The shared harness seeds the real `cams-health-theme` preference through an init script before the app reads storage. It only seeds a missing preference, so a real Settings choice can still be checked across reload. Each case records the actual DOM theme, saved preference, requested theme and computed color scheme. A request for Light does not turn a Dark recovery page into Light evidence. The historical native baseline has no per-case theme metadata; its inferred Dark attribution is explicitly documented in `source-policy.json`.

Set `AUDIT_EXPECT_SOURCE` to the announced final SHA-256 when collecting release evidence. The harness rejects a mismatch before launching Chromium, before each app boot, and at finish. This is an audit source fingerprint, rather than a Git commit SHA. Registered ledgers and supplemental files that are missing or invalid are reported explicitly by the reconciler.

Keep separate output directories for each theme. `AUDIT_NATIVE_SWEEP=1` requests the primary and 200% text profiles; `AUDIT_PROFILES=oppo,oppo-text-200` can request the same profile scope independently of capture policy. The ledger records this declared profile filter and each screen's requested modes before measuring. The reconciler projects an independent expected plan onto that declared filter and includes theme in coverage, duplicate and repair-resolution keys. It cannot use a Light case to fill a Dark gap or resolve a Dark clipping finding. Unrecorded themes remain labelled unrecorded.

For example, the complete Body state set has separate Dark all-nine geometry and Light primary-plus-200% geometry runs:

```sh
AUDIT_THEME=dark AUDIT_METRICS_ONLY=1 AUDIT_BODY_OUTPUT=/workspace/cams-health-layout-audit/body-final-geometry node scripts/audit/body.mjs
AUDIT_THEME=light AUDIT_NATIVE_SWEEP=1 AUDIT_METRICS_ONLY=1 AUDIT_BODY_OUTPUT=/workspace/cams-health-layout-audit/body-light-geometry node scripts/audit/body.mjs
```

These request 5,346 and 1,188 geometry combinations respectively for the 297-state plan. Additional Light all-nine representative-family checks are separate ledgers with their own exact plans; the two-profile state run does not establish all-nine Light coverage. Policy-listed repair or Light ledgers can reference an existing independent plan using `expectedStatesFile`, declare `theme`, and state `coverageScope`. `themeCoverage` in reconciliation and the evidence viewer reports each ledger's expected, observed and missing combinations separately.

The OPPO native test uses424 ×924 CSS pixels at DPR3 to produce1272 ×2772 pixels at the official panel aspect ratio. Browser viewport and DPR are derived assumptions; these tests do not replace physical ColorOS/device verification. Barcode decoding runs on an actual synthetic camera stream; public-product API fixtures and native-camera permission UI are separately identified.

For the staged native sweep use `AUDIT_NATIVE_SWEEP=1`. To resume a saved, identical-source ledger use `AUDIT_RESUME=1`; completed requested profile/mode combinations and their original PNGs are retained. Source changes invalidate resume. The full final matrix runs separately with `AUDIT_METRICS_ONLY=1` and all nine profiles. Native PNG readback uses a short filesystem mutex to avoid software-GPU contention on limited CPU; it does not alter app pixels or layout.

The recorded native baseline also has `native-baseline-source.tar.gz` and `native-baseline-source-manifest.json` in the artifact directory. Restore the recorded Git base and overlay that archive to reproduce its43 top-level public UI sources; health records are excluded. Prototype response overrides are diagnostic only and never count as final-source acceptance.

Final geometry and focused interaction checks use separate ledgers, for example:

```sh
FOOD_AUDIT_PATCH=1 FOOD_AUDIT_OUT=/workspace/cams-health-layout-audit/food-final-geometry node scripts/audit/food.mjs
AUDIT_METRICS_ONLY=1 AUDIT_BODY_OUTPUT=/workspace/cams-health-layout-audit/body-final-geometry node scripts/audit/body.mjs
AUDIT_METRICS_ONLY=1 AUDIT_OUT=/workspace/cams-health-layout-audit/workouts-final-geometry node scripts/audit/workouts.mjs
AUDIT_METRICS_ONLY=1 AUDIT_SHELL_OUT=/workspace/cams-health-layout-audit/shell-final-geometry node scripts/audit/shell.mjs
AUDIT_RESPONSIVE_ONLY=1 AUDIT_OUT=/workspace/cams-health-layout-audit/movements-final/responsive-current node scripts/audit/movements.mjs
AUDIT_SYSTEM_REPAIR=1 AUDIT_SYSTEM_OUT=/workspace/cams-health-layout-audit/system-final-geometry AUDIT_NOSCRIPT_OUT=/workspace/cams-health-layout-audit/noscript-final-geometry node scripts/audit/system.mjs
AUDIT_ACCESSIBILITY_DOMAIN=accessibility-current AUDIT_METRICS_ONLY=1 node scripts/audit/accessibility.mjs
node scripts/audit/goal-accessibility.mjs
node scripts/audit/toast-accessibility.mjs
node scripts/audit/print-handoff.mjs
AUDIT_PWA_OUT=/workspace/cams-health-layout-audit/pwa-current node scripts/audit/pwa.mjs
```

Each domain also records its predeclared affected-view native repair plan. Screenshot readback waits for two animation frames after taking the shared lock. For short-lived notifications, `native-transaction.mjs` takes that lock before the actual user action, measures its result, then captures; a notification that expired while waiting is not valid visual proof. Non-keyboard layout profiles blur retained opener focus before their intentional top reset; keyboard and dedicated focused-field probes test actual focus reachability separately.

A final conditional repair can retain an explicitly reviewed intermediate full matrix through `source-policy.json.retainedSources`: each entry needs `sourceHash`, `label` and `role`. The historical native baseline, retained pre-final matrices and exact final-source cases/PNGs are separately counted and labelled. Source retention accepts attribution only; raw geometry, focus, behavior and manual defects remain visible. It never converts retained cases into final-source cases.

Retained geometry/focus flags can be replaced by an actual final-source case with the exact same theme/state/profile/mode and the corresponding clean measurement. A named failed behavior check requires an explicit entry in a policy-listed `behaviorRetestFiles` manifest. Manual findings require a policy-listed `manualFindingRetestFiles` entry with `findingId`, `originalSourceHash`, `retestLedger`, `retestCheck`, final `sourceHash`, `theme`, nonempty `proofFiles` and a reason. The named check must actually pass with stable final-source observations, matching actual case themes and native PNG proof. Old findings do not disappear when the active source changes.

The stronger toast suite measures visible modal action rows and the heading in addition to live announcements, focus, Escape and dock clearance. `AUDIT_TOAST_SETUP_ONLY=1` requests four independently declared actual Setup save → immediate reopen → validation combinations (primary/200%, popup/full) in a separate output directory. It observes the successful intercepted save before reopening and accepts dismissal of old-context feedback or safe repositioning. Route-overridden prototype runs are explicitly labelled and excluded from acceptance.

The retained `e3042333…` public UI snapshot is preserved in `retained-e304-source.tar.gz` with `retained-e304-source-manifest.json`:43 top-level public JS/CSS/HTML files, exact start/end source checks and archive/file SHA-256 values. Canonical health records and generated service-worker output are excluded. Restore this source snapshot separately from the earlier historical native baseline when reproducing pre-final matrix pixels.

`AUDIT_EXPECT_SOURCE` plus `node scripts/audit/conditional-suite.mjs` runs the separately named final conditional accessibility/Goal/toast/Print proofs sequentially in one browser at a time. It refuses to overwrite any existing result ledger and validates each phase's exact case count, actual theme and stable final source. It requests580 geometry/interaction case rows across both themes:141 accessibility,128 Goal,13 actual toast,4 fallback and4 actual Setup transitions pertheme. The two Print handoff proofs have named checks rather than screen rows. Accessibility uses `AUDIT_FIELD_NATIVE=0`: all68 actual focused field positions are measured pertheme; repeated field PNGs are omitted, while error/header native proofs and all representative Goal native proofs remain enabled. The status is `conditional-audit-final-run-status.json`; failed original phases remain intact.

A retained repair source can explicitly declare `geometrySupersedesSources` with its reviewed predecessor hashes. Only an exact same-theme/state/profile/mode clean row can resolve a predecessor flag. The latest final-source row always takes precedence: a final regression cannot be hidden by an older clean retained row. Focused-input and manual findings require actual corresponding proof. A selector-scoped epilogue can admit a retained proof only through the explicit successor-bound permissions below. Raw flags and every replacement source stay in reconciliation.

A plan may declare `expectedNativeCases` as exact `{id, theme, profile, mode}` rows. Reconciliation requires those cases to contain attributed screenshot links and separately validates the linked PNGs. This permits a full geometry matrix with a smaller, independently declared native component subset; omitted duplicate native images are not labelled captured. For an explicitly mixed-theme manual retest ledger, a review can provide exact `caseKeys` to constrain replacement to its intended theme.

A small reviewed epilogue may use `retentionForActiveSourceHash` on a retained-source entry, bound to the exact active successor fingerprint. `manualRetestRetention` then requires explicit `originalSources`, exact `findingIds` and a reason identifying unaffected selectors. `focusRetestRetention` likewise requires explicit `originalSources`, exact `stateIds` or anchored `idPatterns`, and an unaffected-state reason. The actual named checks, theme, stable original proof source and native PNG requirements still apply. An unlisted finding, a newly discovered finding on the retained source, a different successor hash or a different theme remains unresolved. Admitted proofs remain retained-source counts and images; they never become current-source pixels.

Field observations have different schemas: dedicated keyboard probes record active focus, visibility and keyboard state; native selected-value probes record their measured value, label and visibility. The reconciler checks explicitly recorded properties and does not invent a failed keyboard state when a selected-value proof did not claim to measure it.

For the last selector-scoped epilogue, `AUDIT_TOAST_EPILOGUE_ONLY=1 AUDIT_EXPECT_SOURCE=<final-source-hash> node scripts/audit/conditional-suite.mjs` requests42 fresh ordinary/fallback/Setup cases across both themes in separate `*-epilogue-*` directories. It preserves the580-case conditional cohort and refuses to overwrite existing ledgers. `keyboard-orientation.mjs` runs the three actual keyboard scenarios per theme; `review-timer-toast.mjs` advances Playwright's clock61seconds after an actual60second preset and exercises the real expiry handler, explicitly recording simulated elapsed time. No toast handler, app asset or production style is replaced. Native capture contexts must apply device metrics on the capture session, and every new toast PNG is checked against actual viewport ×DPR before acceptance.

Native image counts exclude wrong-sized or unvalidated screenshots. A raw mismatch remains inspectable and can be resolved only by an exact same-theme/state/profile/mode final-source capture with independently validated metadata and PNG dimensions. An expected native case requires actual validated native images, not merely a filename. Manual findings with multiple required scenarios may list `supportingRetests`; every supporting named check must pass with the same stable proof source and matching theme.

The final audit completion is recorded in `audit-acceptance-final.json`, with exact cohort counts and zero unresolved obligations. Custom-profile metadata corrections preserve original ledgers/case-array hashes and PNG hashes in `food-profile-declarations-receipt.json`, `shell-select-values-repaired/metadata-correction/receipt.json` and `movements-final/236ecb-variant-controls/profile-metadata-correction.json`. Food targeted reproduction drivers are in this directory (`food-current-*`, `food-daytype-current.mjs`, `food-transition-current.mjs`); their exact commands/hashes are in `food-audit-driver-reproduction.json`. Retained Movement and Shell specialized artifact drivers remain source-labelled in their correction receipts. Their older-source pixels must be reproduced from the corresponding archived UI snapshot, rather than the final checkout.

Auxiliary native captures reuse the main configured CDP session. Detaching a second session can reset global device metrics while the main session retains a cached override. The original ten DPR1 observations are retained; `workouts-dpr-final` contains only the ten exact final-source replacement rows, with actual DPR/viewport assertions. Raw mismatch totals and unresolved mismatch totals are deliberately separate.
