# Dedicated menu reviewer queue

One independent GPT-6 Luna/MAX reviewer per inventoried PWA menu or submenu, plus the three native companion menus. Each task visually inspects its own screenshots and state surfaces, reads the manifest/diagnostics, and writes a brief case report under this directory. Do not change app source or real data. Keep unverified states blocked.

Inventory source: /workspace/Cam-s-Health/scripts/ui-audit/inventory.mjs (61 PWA menu/disclosure cases). Native rows are owner-required companion setup/privacy/date-range cases. Total: 64.

| # | Case | Group | Screen | Reviewer | Status |
|---:|---|---|---|---|---|
| 1 | `watch-review` | PWA · life-settings | `settings` | /root/night_luna_strict_reviewer/review_watch_review_final | Complete; post-patch selection/error copy, current transitions, keyboard, mock save and refusal reviewed; Android/live service scope explicitly blocked |
| 2 | `watch-setup` | PWA · life-settings | `settings` | /root/night_luna_strict_reviewer/review_watch_setup | Complete; all 7 scoped categories 100; final 25-image matrix and focus/motion tests reviewed |
| 3 | `watch-supported-readings` | PWA · life-settings | `settings` | /root/night_luna_strict_reviewer/review_watch_supported | Complete; all 9 combos, interactions and motion passed in scoped PWA flow |
| 4 | `watch-file-picker` | PWA · life-settings | `settings` | /root/night_luna_strict_reviewer/review_watch_file_picker | Complete; all 7 scoped categories 100; native chooser blocked/out of app scope |
| 5 | `quick-log` | PWA · health | `dashboard` | /root/night_luna_strict_reviewer/review_quick_log | Complete; no-animation pass |
| 6 | `food-detail` | PWA · health | `nutrition` | /root/night_luna_strict_reviewer/review_food_detail | Complete; all 7 scoped categories 100; current matrix and ordinary/reduced motion reviewed |
| 7 | `food-detail-source-open` | PWA · health | `nutrition` | /root/night_luna_strict_reviewer/review_food_source | Complete; motion recheck requested |
| 8 | `food-log` | PWA · health | `nutrition` | /root/night_luna_strict_reviewer/review_food_log_final | Complete; final current-source captures, 360×200/500 keyboard, dismissal, save/refusal, disclosure and draft retention rechecked |
| 9 | `food-log-auth-open` | PWA · health | `nutrition` | /root/night_luna_strict_reviewer/review_food_log_auth | Complete; public notice, placeholder and motion rechecked |
| 10 | `food-edit` | PWA · health | `nutrition` | /root/night_luna_strict_reviewer/review_food_edit | Complete; public notice/motion rechecked |
| 11 | `food-repeat` | PWA · health | `nutrition` | /root/night_luna_strict_reviewer/review_food_repeat | Complete; current-source 9-combo matrix, 14px public-record notice, rapid pointer/touch, delay, motion, keyboard proxy, save/refusal/draft and dirty-refresh guard rechecked; no current finding |
| 12 | `food-delete-confirm` | PWA · health | `nutrition` | /root/night_luna_strict_reviewer/review_food_delete | Complete; draft preservation, Escape/Back/refusal/fixture delete verified; native keyboard blocked |
| 13 | `recent-food-repeat` | PWA · health | `nutrition` | /root/night_luna_strict_reviewer/review_recent_food_repeat | Complete; current-source all 9 combos, keyboard proxy, interactions, fixture save and motion; scoped pass |
| 14 | `recipe-portion` | PWA · health | `nutrition` | /root/night_luna_strict_reviewer/review_recipe_portion_final | Complete; central-matching 9-combo portion sheet and scoped all-macro preview matrix reviewed; focus/dismissal, keyboard proxy, motion, mock save/refusal/conflict passed; native/live scope blocked |
| 15 | `recipe-preview` | PWA · health | `nutrition` | /root/night_luna_strict_reviewer/review_recipe_preview_final | Complete; corrected all-macro preview, current 9-setting matrix, expanded-disclosure keyboard proxy, dismissal/focus, mock refusal/partial-nutrition save, and ordinary/reduced motion reviewed; native Android/live GitHub blocked |
| 16 | `steps-total` | PWA · health | `dashboard` | /root/night_luna_strict_reviewer/review_steps_total_final | Complete; current-source 9-combo matrix and 360×500/200 focus/scroll, validation, dismissal, offline/auth/mock-save/refusal, motion and rapid activation reviewed; live GitHub/native keyboard blocked |
| 17 | `water-total` | PWA · health | `dashboard` | /root/night_luna_strict_reviewer/review_water_total_final | Complete; current-source 9-setting matrix, keyboard proxy, focus/discard, motion/repeat and mocked refusal reviewed; native Android/live GitHub blocked |
| 18 | `day-notes` | PWA · health | `dashboard` | /root/night_luna_strict_reviewer/review_day_notes_final | Complete; six categories 100, keyboard category BLOCKED for native Android; current fixture interactions and motion reviewed |
| 19 | `daily-checkin` | PWA · health | `dashboard` | /root/night_luna_strict_reviewer/review_daily_checkin_final | Reviewed current-source 9-combo sheet plus synthetic keyboard/save/refusal/conflict/offline/motion; follow-up needed for yearless date, 250 kg input cap vs 300 kg schema, stale auth disclosure; native Android/live GitHub blocked |
| 20 | `daily-checkin-auth-open` | PWA · health | `dashboard` | — | Queued |
| 21 | `unsaved-discard-prompt` | PWA · health | `nutrition` | /root/night_luna_strict_reviewer/review_unsaved_discard_final | Complete; categories 1–3,7 100; category 4 blocked for native Android keyboard evidence; categories 5–6 80 due rapid Discard double-click activating underlying Life tab |
| 22 | `workout-preview` | PWA · training | `training` | — | Queued |
| 23 | `workout-preview-technique-open` | PWA · training | `training` | — | Queued |
| 24 | `recorded-session` | PWA · training | `training` | /root/night_luna_strict_reviewer/review_recorded_session_final | Complete; all 9 selected settings inspected; no visual finding; focus/motion/workflow BLOCKED |
| 25 | `workout-log-custom` | PWA · training | `training` | — | Queued |
| 26 | `workout-log-planned` | PWA · training | `workout/upper` | — | Queued |
| 27 | `workout-log-rest` | PWA · training | `workout/rest` | — | Queued |
| 28 | `workout-log-exercises-open` | PWA · training | `training` | — | Queued |
| 29 | `workout-edit` | PWA · training | `training` | — | Queued |
| 30 | `workout-delete-confirm` | PWA · training | `training` | — | Queued |
| 31 | `rest-timer-idle` | PWA · training | `training` | — | Queued |
| 32 | `rest-timer-running` | PWA · training | `training` | — | Queued |
| 33 | `rest-timer-paused` | PWA · training | `training` | — | Queued |
| 34 | `body-checkin` | PWA · body | `body` | — | Queued |
| 35 | `body-checkin-measurements-auth-open` | PWA · body | `body` | — | Queued |
| 36 | `body-historical-edit` | PWA · body | `body` | — | Queued |
| 37 | `body-chart-values-open` | PWA · body | `body` | — | Queued |
| 38 | `body-chart-bodyfat-mixed-methods` | PWA · body | `body` | — | Queued |
| 39 | `body-chart-all-range` | PWA · body | `body` | — | Queued |
| 40 | `insights-values-open` | PWA · body | `insights` | — | Queued |
| 41 | `program-notes-open` | PWA · training | `training` | — | Queued |
| 42 | `workout-technique-open` | PWA · training | `workout/upper` | — | Queued |
| 43 | `add-task` | PWA · life-settings | `life` | — | Queued |
| 44 | `add-delivery` | PWA · life-settings | `life` | — | Queued |
| 45 | `saved-facts` | PWA · life-settings | `life` | — | Queued |
| 46 | `completed-tasks-open` | PWA · life-settings | `life` | — | Queued |
| 47 | `inbox-unread` | PWA · life-settings | `inbox` | — | Queued |
| 48 | `inbox-action` | PWA · life-settings | `inbox` | — | Queued |
| 49 | `inbox-noise` | PWA · life-settings | `inbox` | — | Queued |
| 50 | `cleanup-review-trash` | PWA · life-settings | `inbox` | — | Queued |
| 51 | `cleanup-review-archive` | PWA · life-settings | `inbox` | — | Queued |
| 52 | `cleanup-review-read` | PWA · life-settings | `inbox` | — | Queued |
| 53 | `gmail-setup` | PWA · life-settings | `settings` | — | Queued |
| 54 | `gmail-setup-redirect-copy` | PWA · life-settings | `settings` | — | Queued |
| 55 | `github-connect` | PWA · life-settings | `settings` | — | Queued |
| 56 | `targets-profile` | PWA · life-settings | `settings` | — | Queued |
| 57 | `targets-profile-auth-open` | PWA · life-settings | `settings` | — | Queued |
| 58 | `sync-diagnostics` | PWA · life-settings | `settings` | — | Queued |
| 59 | `daily-brief` | PWA · health | `settings` | — | Queued |
| 60 | `reviewed-app-update` | PWA · life-settings | `settings` | — | Queued |
| 61 | `native-watch-setup` | Native companion | Android setup | /root/night_luna_watch_native | Complete; 6 categories 100; data honesty blocked for live-device scope |
| 62 | `watch-review-auth-open` | PWA · life-settings | `settings` | — | Queued; distinct inline auth submenu |
| 63 | `native-watch-privacy` | Native companion | Android privacy | — | Queued; await APK builder |
| 64 | `native-watch-date-range` | Native companion | Android date-range Spinner | — | Queued; dedicated submenu reviewer required |
