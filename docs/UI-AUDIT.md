# Mobile UI acceptance

The October 2026 visual guide is the sixteen Samsung Health screenshots supplied by the owner. The unrelated cake menu was attached by mistake and is excluded. Preserve the product name Cam’s Life and every existing record. Do not copy Samsung’s sample measurements, diagnoses, energy scores or sleep scores into the app.

The target is 100/100 in each applicable review category, earned through evidence. An untested state is blocked, not a perfect score. Scores describe the tested state and viewport; they are not a guarantee about all devices or future data. Each menu/submenu receives a dedicated independent GPT-6 Luna reviewer at maximum reasoning, in addition to the builder’s actual screenshot inspection.

## Required coverage

- Inspect every screen, menu and nested disclosure at top, overlapping scroll positions and the actual bottom. The inventory and isolated browser harness live in `scripts/ui-audit/`.
- Test 424, 390 and 360 CSS pixel widths with 100%, 130% and 200% text. Enlarge computed text, including field values and placeholders; do not reduce fonts to conceal a failure.
- Focus inputs at the full viewport, then reduce the viewport to 500px for keyboard layout checks. Reach final Save/Cancel controls and preserve the draft after refusal or dismissal. This is a browser proxy; native Android keyboard behavior needs its own evidence.
- Include populated, empty, loading, unavailable, offline, update, long-text, validation, authorization, busy, conflict and save-refusal states. Use isolated synthetic data and intercept external services; audit work must never change the real mailbox or records.
- Inspect ordinary and reduced-motion screenshots for open/close, nested forms, dismissal, rapid repeated taps, refresh and timer updates. Do not rebuild the timer controls on every tick or reload a dirty form for an app update.
- Verify native companion setup and privacy screens separately, including real Android enlarged text and system insets. Phone/watch pairing and permission approval require the owner’s device; do not infer a connection from a build or emulator.

## Strict review criteria

1. Reference typography, color, layout and artwork: compact humanist typography, cream text, cool navy/amber canvas, charcoal cards, generous radii and varied card compositions. The owner's later correction requires smaller default text and broader, rounder letterforms; the active locally served Noto Sans replaces Roboto. Page titles use 22px and supporting card headings 18–20px. This is a reference-informed alternative, not a claim that Samsung's proprietary SamsungOne font is bundled. Food detail uses its black canvas and purple/coral/yellow macro language. Forms use matching neutral surfaces; unrelated landing artwork is not required inside a form.
2. Text and numbers: full labels, descriptions, units and error messages remain readable and contained, including long user content. Unknown readings stay unknown; recorded values retain their provenance.
3. Spacing: consistent insets and gaps, natural heights, appropriate card hierarchy and at least 44px app touch targets.
4. Scrolling and keyboard: all content and final controls can be revealed. Fixed navigation deliberately floats over the next card as in the references; ordinary content passing behind it or an opaque sticky heading is viewport occlusion, not clipped data. Unreachable content or an unrevealable focused control fails.
5. Overlays and focus: a single native modal, background controls inaccessible, no dock/timer over another popup, exclusive unsaved-change prompt, retained drafts, keyboard-visible focus and return to the originating control. Pointer focus need not show a keyboard-only ring.
6. Stability and interactions: current markup remains stable during routine refresh/timer ticks; rapid taps cannot activate newly appearing choices underneath. Screenshots and interaction checks must both pass. If repeated image previews appear inconsistent, compare the original PNG bytes/pixels before attributing it to the app; identical source files cannot contain differing app frames.
7. Data honesty: conflict-checked verified saves; no invented numbers, hidden replacements, duplicate imports, unsolicited model calls or real-service writes during tests. Score only the case’s applicable behavior; do not claim live-service or hardware validation from fixtures.

Review reports must name concrete failed criteria, exact screenshot paths, viewport/text settings and any unverified scope. Fix confirmed defects, recapture the affected state and have its reviewer inspect the correction. Preserve all health/Gmail/life data, PWA update boundaries, public-font/artwork provenance and the existing private-site audience.
