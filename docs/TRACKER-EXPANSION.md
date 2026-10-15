# Tracker expansion — accepted scope

The user authorized all 50 brainstormed additions on 15 October 2026. Keep exactly three home categories: Food, Body comp, Workouts. All new tools stay within their category or appearance/settings. Keep source health history unchanged during release; new optional fields are written only when explicitly used.

## Integration contract

Feature modules export createFoodStudio/createBodyStudio/createWorkoutStudio(ctx), returning open(mode), handleClick(event), optional handleInput/handleChange. ctx.data/date/units are property getters; sheet is the actual dialog. Helpers: openSheet, closeSheet, setSheetMode, render, toast, esc, fmt, id, dateLabel, icon, button, authFields, saveFooter, wireForm, save(mutator,message), foodForm, bodyForm, workoutForm, selectDate, startTimer, previewWorkout, openExerciseStudio, onSheetCleanup(fn). Root owns studio.js and PWA/build integration. Module click handlers run before legacy button routing. Namespace data-fs/data-bs/data-ws. Every mutation uses the existing GitHub validation/conflict/read-back save pipeline. New optional feature storage is data.tracker.food/body/workouts. Browser-only preferences and drafts never store tokens or auto replay writes.

## Feature checklist

| # | Addition | Owner | Verification |
|---|---|---|---|
|1|Meal templates|food_expansion|Food model + integrated flows|
|2|Barcode lookup/camera|food_expansion|Food model + integrated flows|
|3|On-device label OCR with review|food_expansion|Food model + integrated flows|
|4|Cross-day food search|food_expansion|Food model + integrated flows|
|5|Favourite/custom food library|food_expansion|Food model + integrated flows|
|6|Portion units and explicit conversions|food_expansion|Food model + integrated flows|
|7|Live portion preview|food_expansion|Food model + integrated flows|
|8|Meal groups|food_expansion|Food model + integrated flows|
|9|Recipe builder|food_expansion|Food model + integrated flows|
|10|Immutable recipe versions|food_expansion|Food model + integrated flows|
|11|Planned meals separate from logged|food_expansion|Food model + integrated flows|
|12|Nutrition review queue|food_expansion|Food model + integrated flows|
|13|Protein-first view|food_expansion|Food model + integrated flows|
|14|Training/rest targets|food_expansion|Food model + integrated flows|
|15|Weekly food patterns/completeness|food_expansion|Food model + integrated flows|
|16|Quick weigh-in|body_expansion|Body model + integrated flows|
|17|Interactive body map|body_expansion|Body model + integrated flows|
|18|Two-date comparison|body_expansion|Body model + integrated flows|
|19|Smoothed weight trend plus raw readings|body_expansion|Body model + integrated flows|
|20|Chart goal bands|body_expansion|Body model + integrated flows|
|21|Method filters|body_expansion|Body model + integrated flows|
|22|Chart annotations|body_expansion|Body model + integrated flows|
|23|Chart-point details|body_expansion|Body model + integrated flows|
|24|Pinned body metrics|body_expansion|Body model + integrated flows|
|25|Optional check-in schedule/reminders|body_expansion|Body model + integrated flows|
|26|CSV import/mapping/duplicate preview|body_expansion|Body model + integrated flows|
|27|Paired left/right comparisons|body_expansion|Body model + integrated flows|
|28|Live workout player|workout_expansion|Workout model + integrated flows|
|29|Individual set logging|workout_expansion|Workout model + integrated flows|
|30|Previous performance overlay|workout_expansion|Workout model + integrated flows|
|31|Warmup/working sets|workout_expansion|Workout model + integrated flows|
|32|RIR/RPE|workout_expansion|Workout model + integrated flows|
|33|Supersets|workout_expansion|Workout model + integrated flows|
|34|Set-linked rest timer|workout_expansion|Workout model + integrated flows|
|35|User-selected equipment-filtered substitutions|workout_expansion|Workout model + integrated flows|
|36|User-defined progression milestones|workout_expansion|Workout model + integrated flows|
|37|Actual-only personal records|workout_expansion|Workout model + integrated flows|
|38|Weekly training volume|workout_expansion|Workout model + integrated flows|
|39|Demo camera angles|demo_expansion|Renderer + touch browser checks|
|40|Left/right demo mirroring|demo_expansion|Renderer + touch browser checks|
|41|Demo timeline/speed controls|demo_expansion|Renderer + touch browser checks|
|42|Joint paths and form overlays|demo_expansion|Renderer + touch browser checks|
|43|Widget order/relative sizing|shell_expansion|Shell model + browser checks|
|44|Compact/detailed home|shell_expansion|Shell model + browser checks|
|45|Hold progress/haptics|shell_expansion|Shell model + browser checks|
|46|Remember detail state/scroll|shell_expansion/root|Shell model + browser checks|
|47|Glass clarity/contrast|shell_expansion|Shell model + browser checks|
|48|Curated accent palettes|shell_expansion|Shell model + browser checks|
|49|Conflict-safe one-step undo|tracker_shared/root|Undo conflicts + integrated saves|
|50|Recoverable local drafts|shell_expansion/root|Reload recovery + unit safety|

## Verification boundaries

Browser QA uses synthetic fixtures and mocked GitHub writes, never writes the user's actual health record. Product lookup calls only the public barcode; label images stay local, are not saved or uploaded. Optional reminders must state their actual delivery mechanism; no background notification promises without a running service. Unknown values stay unknown. No AI provider, life/inbox/watch feature restoration, or silent offline writes.

## Release verification

All 50 entries are implemented. Feature tests cover unknown values, portion conversions, immutable recipe versions, method-specific trends, CSV duplicates and conflicts, actual-only workout records, set corrections, undo concurrency and draft sanitization. All 273 Node tests, the canonical health validator and the production build pass.

Integrated Chromium checks used synthetic fixtures and intercepted GitHub requests. Food completed eight verified mock saves, two immutable recipe versions, planned-versus-logged separation, dynamic recipe draft recovery and local OCR of all four nutrients. Body verified quick weigh-in, preserved other fields, goal bands, import review, chart memory and imperial draft recovery. Workouts verified inline prewarmed demos, session recovery, save/undo preserving a concurrent food entry, and per-set corrections preserving IDs, timestamps and unknown metadata; a concurrent edit was rejected before writing.

The movement viewer passed 22 integrated checks, plus genuine touch long-press and two-finger pinch checks. Shell controls and tool views were checked at 320 and 390 pixels; Food and appearance also fit wider viewports. Root integration verified portion recovery after reload, safe cancellation during an in-flight save, food completeness invalidation, and undo preserving a newer weight reading. No release check wrote the canonical health record.

Camera permission, haptics and browser notifications depend on browser/device support. Barcode camera input has a manual-code fallback; the public Open Food Facts response mapping was tested with a fixture. Label OCR runs locally with bundled engines and editable review. Browser reminders explicitly require the app to remain open; downloadable calendar reminders provide the calendar alternative. These checks used desktop Chromium with mobile viewports, not a physical phone.

Large OCR/barcode libraries are downloaded only on first use and cached only after exact digest verification. Health records, imports, photos and credentials stay outside CacheStorage. Appearance, reading position and unfinished drafts are local browser preferences; they never auto-submit records.
