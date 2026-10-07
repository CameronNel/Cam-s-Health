/** Isolated visual fixtures. All writes stop in memory; no real account/data mutation. */
import { acquireAuditBrowser } from './browser.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLifeHealth } from '../../dist/health-intelligence.js';
import { createLifeState, validateLifeState } from '../../dist/life-model.js';
import { shiftDate } from '../../dist/model.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATE = '2026-10-06';
export const ORIGIN = process.env.CAMS_AUDIT_ORIGIN || 'http://127.0.0.1:5187';
export const EVIDENCE = '/tmp/cams-life/night-audit';
export const WIDTHS = [424, 390, 360];
export const TEXT_SCALES = [100, 130, 200];

export function makeHealth({ empty = false, long = true, mixedMethods = false, trainingStatus = 'ready' } = {}) {
  const exercises = Array.from({ length: 8 }, (_, i) => ({ name: i === 0 && long ? 'Single-arm supported cable lateral raise with controlled eccentric' : ['Cable lateral raise', 'Dumbbell bench press', 'Seated cable row', 'Incline dumbbell press', 'Lat pulldown', 'Cable rear-delt fly', 'Hammer curl', 'Cable triceps pressdown'][i], sets: 3, reps: '10–15', rest: 90, note: 'Move through a comfortable range. Record your actual load and reps, and stop if the movement causes pain. Add weight only after all recorded sets reach the upper rep range.' }));
  const data = { schemaVersion: 1, updatedAt: '2026-10-06T18:00:00Z', profile: { name: 'Cam', timezone: 'Europe/Amsterdam', heightCm: 178, targets: { kcal: 2300, protein: 150, carbs: 260, fat: 70, steps: 10000 }, trainingStatus, trainingNote: 'Synthetic visual audit fixture only.', equipment: ['Dumbbells', 'Cables'] }, training: { rotation: ['upper', 'lower', 'rest'], sessions: [{ id: 'upper', name: long ? 'Upper body · controlled strength and mobility' : 'Upper body', focus: 'Push and pull movements with enough space for recovery.', exercises }, { id: 'lower', name: 'Lower body & core', focus: 'Controlled lower-body strength and stability.', exercises: ['Goblet squat', 'Reverse dumbbell lunge', 'Romanian deadlift', 'Cable hamstring curl', 'Single-leg calf raise', 'Cable crunch'].map(name => ({ ...exercises[0], name })) }, { id: 'rest', name: 'Recovery day', focus: 'Rest or gentle movement when appropriate.', exercises: [] }], notes: ['Use the actual session log for completed work. A prescribed workout is a plan, not a completed record.', 'If a movement feels uncomfortable, stop and review it before continuing. This fixture intentionally uses long text to expose clipped wrapping.'] }, recipes: [{ id: 'recipe-visual', name: long ? 'Slow-cooked chicken, brown rice and roasted vegetable meal-prep bowl' : 'Chicken rice bowl', yieldG: 1200, total: { kcal: 1500, protein: 160, carbs: 160, fat: 24 }, per100g: { kcal: 125, protein: 13.3, carbs: 13.3, fat: 2 }, ingredients: [], estimated: true, source: 'Synthetic labelled recipe fixture.', note: 'Portion values are derived from this saved batch. Review the serving weight before logging. This is an isolated visual audit recipe and never becomes a real health entry.' }], days: {} };
  if (!empty) for (let i = 44; i >= 0; i--) {
    const date = shiftDate(DATE, -i), current = i === 0;
    data.days[date] = { food: Array.from({ length: current ? 7 : 2 }, (_, f) => ({ id: `food-${i}-${f}`, name: current && f === 0 && long ? 'Roasted chicken breast with lemon herb sauce, brown rice and steamed broccoli' : ['Greek yoghurt and berries', 'Wholegrain chicken sandwich', 'Coffee with milk'][f % 3], quantity: long && current ? '1 large cooked serving, weighed after preparation (approximately 350 g)' : '1 labelled serving', kcal: 420 + f * 10, protein: 30 + f, carbs: 35 + f, fat: 12 + f, estimated: f % 2 === 0, reviewRequired: current && f === 0, source: 'Packaging label · synthetic visual fixture', note: long && current ? 'Recorded portion and original assumptions remain available. This long note is synthetic, used only to inspect wrapping, spacing and scroll reachability in the app.' : '' })), workouts: i % 3 === 0 ? [{ id: `workout-${i}`, sessionId: 'upper', name: long ? 'Upper body strength · longer recorded session with modified movements' : 'Upper body', status: i % 2 ? 'partial' : 'completed', durationMin: 68, actualExercises: exercises.slice(0, 4).map(e => ({ name: e.name, sets: 3, reps: '12, 11, 10', load: 17.5 })), notes: 'Actual recorded performance. This synthetic long session note should wrap cleanly and remain readable when the user increases their phone font size.' }] : [], steps: 6800 + i * 13, waterMl: 2200 + i * 10, weightKg: Math.round((82 - (44 - i) * .05) * 10) / 10, notes: 'A synthetic day note for visual audit.', wellbeing: { mood: 4, energy: 3, sleepHours: 7.5, feelings: long ? 'Feeling rested after a quieter evening. This long check-in text exists only in the fixture to test readable wrapping and robust card height.' : 'Rested.' }, body: { bodyFatPct: 21 + i * .02, skeletalMuscleKg: 31.5, method: mixedMethods && i % 2 ? 'DEXA' : 'BIA watch', measurementsCm: { neck: 38, shoulders: 114, chest: 102, waist: 87 + i * .02, hips: 98, upperArmLeft: 33, upperArmRight: 33, forearmLeft: 27, forearmRight: 27, thighLeft: 56, thighRight: 56, calfLeft: 37, calfRight: 37 }, notes: 'Morning check-in, synthetic fixture only.', recordedAt: date + 'T07:00:00Z' } };
  }
  return validateLifeHealth(data);
}

export function makeLife({ empty = false, long = true } = {}) {
  const state = createLifeState();
  if (!empty) {
    state.tasks = Array.from({ length: 9 }, (_, i) => ({ id: `task-${i}`, title: long ? ['Collect my repaired headphones from the service counter before the weekend', 'Confirm the appointment time and send the requested documents by email', 'Review the delivery address for the replacement laptop charging cable'][i % 3] : 'Review an appointment', status: i === 8 ? 'done' : 'open', source: i % 2 ? 'manual' : 'email', sourceEmailId: i % 2 ? null : `mail-${i}`, dueDate: shiftDate(DATE, i), createdAt: '2026-10-06T08:00:00Z' }));
    state.deliveries = Array.from({ length: 5 }, (_, i) => ({ id: `delivery-${i}`, title: long ? 'Replacement wireless headphones and accessories from a very long merchant name' : 'Headphones', carrier: ['PostNL', 'DHL', 'DPD'][i % 3], status: i === 0 ? 'ready_for_pickup' : i === 4 ? 'picked_up' : 'in_transit', trackingNumber: '3SMYVERYLO00012345678901234567890', pickupCode: i === 0 ? '1234 5678 9012' : null, pickupLocation: 'Parcel collection desk · North shopping centre, entrance next to the supermarket', pickupDeadline: '2026-10-10', sourceEmailIds: [`mail-${i}`] }));
    state.favorites = ['venus-day', 'dna-length', 'gps-relativity', 'corona-hotter'];
    state.emails = Array.from({ length: 12 }, (_, i) => ({ id: `mail-${i}`, subject: i % 3 === 0 ? 'Codex automatic review complete for pull request #123 — exceptionally long branch title' : i % 3 === 1 ? 'Please confirm your appointment before 10 October 2026' : 'Your parcel is ready for collection at the shopping centre service desk', from: i % 3 === 0 ? 'notifications@github.com' : 'Fixture Sender <sender@example.invalid>', fromEmail: i % 3 === 0 ? 'notifications@github.com' : 'sender@example.invalid', fromName: 'Synthetic long sender name for wrapping review', date: '2026-10-06T17:00:00Z', unread: i % 4 !== 1, body: i % 3 === 0 ? 'Codex auto review completed. Automated review notification.' : 'Please reply by 10 October 2026. This is an isolated visual fixture.', snippet: 'A deliberately long email preview that should wrap across multiple lines without hiding the subject, sender, category or action controls. This is not real mail.' }));
    state.lastDigest = { summary: 'Twelve messages reviewed: appointments to confirm, packages to collect, and automatic review notifications ready for a careful cleanup. This long summary checks the reading rhythm and spacing at larger system font sizes.', total: 12, counts: { action: 4, noise: 4, update: 4 }, generatedAt: '2026-10-06T18:00:00Z' };
  }
  return validateLifeState(state);
}

export async function createFixture({ auditBrowser = null, origin = ORIGIN, width = 424, height = 924, textScale = 100, empty = false, long = true, mixedMethods = false, trainingStatus = 'ready', privateError = false, healthError = false, loadDelay = 0, offline = false, gmail = false, gmailConnected = false, reducedMotion = 'reduce', updateReady = false, writeError = false } = {}) {
  const lease = auditBrowser ? null : await acquireAuditBrowser();
  const browser = auditBrowser || lease.browser;
  let context;
  try { context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: 'dark', reducedMotion, serviceWorkers: 'block' }); }
  catch (error) { if(lease)await lease.release(); throw error; }
  context.setDefaultTimeout(8000);
  let health = makeHealth({ empty, long, mixedMethods, trainingStatus }), life = makeLife({ empty, long }), sha = 'fixture-start', version = 0;
  const requests = [], errors = [], writes = [], blocked = [];
  // The mock lifecycle makes reviewed-update UI testable without installing or caching a worker.
  await context.addInitScript(({ offline, updateReady }) => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => !offline });
    const events = new EventTarget(), waiting = updateReady ? { postMessage: () => {} } : null;
    const registration = { active: { state: 'activated' }, waiting, installing: null, update: async () => {}, addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: async () => registration, addEventListener: (...a) => events.addEventListener(...a), removeEventListener: (...a) => events.removeEventListener(...a), ready: Promise.resolve(registration), getRegistration: async () => registration, getRegistrations: async () => [] } });
    window.__auditSetOffline = value => { offline = value; window.dispatchEvent(new Event(value ? 'offline' : 'online')); };
    window.__auditServiceWorkerMock = true;
  }, { offline, updateReady });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    requests.push({ method, origin: url.origin, path: url.pathname });
    if (url.origin === 'https://raw.githubusercontent.com' || url.origin === 'https://api.github.com') {
      if (loadDelay) await new Promise(resolve => setTimeout(resolve, loadDelay));
      if (healthError) return route.fulfill({ status: 503, json: { error: 'Synthetic GitHub unavailable' } });
      if (url.pathname === '/user') return route.fulfill({ json: { login: 'visual-fixture' } });
      if (!url.pathname.endsWith('/dist/data/health.json') && !url.pathname.endsWith('/contents/dist/data/health.json')) { blocked.push(url.href); return route.abort(); }
      if (method === 'PUT') {
        if (writeError) return route.fulfill({ status: 403, json: { error: 'Synthetic save refusal' } });
        const body = request.postDataJSON();
        if (body.sha !== sha) return route.fulfill({ status: 409, json: { error: 'Synthetic SHA conflict' } });
        const next = JSON.parse(Buffer.from(body.content, 'base64').toString()); validateLifeHealth(next); health = next; sha = 'fixture-' + (writes.length + 1); writes.push({ kind: 'health', message: body.message });
        return route.fulfill({ json: { commit: { sha: 'fixture-commit-' + writes.length } } });
      }
      return route.fulfill({ json: url.origin.includes('raw.') ? health : { sha, content: Buffer.from(JSON.stringify(health)).toString('base64') } });
    }
    if (url.origin !== origin) { blocked.push(url.href); return route.abort(); }
    if (url.pathname === '/data/health.json') return route.fulfill(healthError ? { status: 503, json: { error: 'Synthetic fallback unavailable' } } : { json: health });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (loadDelay) await new Promise(resolve => setTimeout(resolve, loadDelay));
    if (privateError) return route.fulfill({ status: 503, json: { message: 'Private storage unavailable. Synthetic fixture only.' } });
    const status = { storage: true, gmail, gmailConnected, hourlyEnabled: false, gmailSetup: { storageReady: true, encryptionReady: true, redirectUri: origin + '/api/inbox/callback', configured: gmail } };
    if (url.pathname === '/api/status') return route.fulfill({ json: status });
    if (url.pathname === '/api/life') {
      if (method === 'PUT') { if (writeError) return route.fulfill({ status: 409, json: { message: 'Private records changed. Synthetic conflict.' } }); const body = request.postDataJSON(); validateLifeState(body.state); life = body.state; version++; writes.push({ kind: 'life' }); }
      return route.fulfill({ json: { state: life, version } });
    }
    if (url.pathname === '/api/inbox/sync') return route.fulfill({ json: { state: life, emails: life.emails || [] } });
    if (url.pathname === '/api/inbox/setup') return route.fulfill({ json: { ...status, configured: true } });
    if (url.pathname === '/api/inbox/cleanup') return route.fulfill({ json: request.postDataJSON().stage === 'preview' ? { previewToken: 'synthetic-preview' } : { ok: true } });
    if (url.pathname === '/api/inbox/disconnect') return route.fulfill({ json: { ok: true } });
    if (url.pathname === '/api/inbox/connect') return route.fulfill({ status: 503, json: { message: 'Fixture blocks external Google sign-in. No account was opened.' } });
    blocked.push(url.pathname); return route.fulfill({ status: 404, json: { message: 'Uninventoried fixture API route: ' + url.pathname } });
  });
  const page = await context.newPage();
  // Keep the synthetic fixture's “today” deterministic across timezone midnight.
  // Fixed time changes Date only; ordinary timers and motion remain active.
  await page.clock.setFixedTime(new Date(DATE + 'T18:00:00Z'));
  page.on('pageerror', e => errors.push(e.message));
  return { browser, context, page, origin, width, height, textScale, errors, requests, writes, blocked, get health() { return health; }, get life() { return life; }, async close() { try { await context.close(); } finally { if(lease)await lease.release(); } } };
}

export async function settle(page, delay = 100) { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(delay); }
export async function gotoView(fixture, view = 'dashboard', { date = DATE, wait = true } = {}) { await fixture.page.goto(`${fixture.origin}/?date=${date}#${view}`, { waitUntil: 'domcontentloaded' }); if (wait) { await fixture.page.locator('.bottom-nav').waitFor(); await settle(fixture.page); } }

/** Scale every CSS font, including px declarations, in one pass. Normal CSS is restored before rescales. */
export async function scaleText(page, percentage = 100) {
  await page.evaluate(percentage => {
    document.querySelectorAll('[data-audit-font]').forEach(el => { el.style.setProperty('font-size',el.dataset.auditFont,el.dataset.auditFontPriority);el.style.setProperty('line-height',el.dataset.auditLine,el.dataset.auditLinePriority);el.style.removeProperty('--audit-placeholder-font');for(const key of ['auditFont','auditLine','auditFontPriority','auditLinePriority'])delete el.dataset[key]; });
    document.querySelector('#audit-text-scale')?.remove();
    if (percentage === 100) return;
    const candidates = [...document.querySelectorAll('body *')].filter(el => !el.closest('svg') && el.getClientRects().length).map(el => { const s = getComputedStyle(el); return { el, font: parseFloat(s.fontSize), line: s.lineHeight, placeholder:el.matches('input,textarea')?parseFloat(getComputedStyle(el,'::placeholder').fontSize):null }; });
    for (const { el, font, line, placeholder } of candidates) { el.dataset.auditFont = el.style.fontSize;el.dataset.auditLine = el.style.lineHeight;el.dataset.auditFontPriority=el.style.getPropertyPriority('font-size');el.dataset.auditLinePriority=el.style.getPropertyPriority('line-height');el.style.setProperty('font-size',font * percentage / 100 + 'px','important');if(line !== 'normal')el.style.setProperty('line-height',parseFloat(line)*percentage/100+'px','important');if(placeholder)el.style.setProperty('--audit-placeholder-font',placeholder*percentage/100+'px'); }
    const style=document.createElement('style');style.id='audit-text-scale';style.textContent='input[data-audit-font]::placeholder,textarea[data-audit-font]::placeholder{font-size:var(--audit-placeholder-font)!important;line-height:inherit!important}';document.head.append(style);
  }, percentage);
  await settle(page, 80);
}

export async function diagnostics(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('#sheet[open]');
    const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden' && s.clip === 'auto' && s.clipPath === 'none' && r.bottom >= 0 && r.top <= innerHeight && (!dialog || el.closest('#sheet')); };
    const clipCandidates = [], tinyTargets = [], obstructed = [], fonts = {};
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || el.closest('svg,.sr-only,.skip-link') || el.matches('html,body,script,style')) continue;
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      if (el.matches('button,a,input,select,summary,textarea') && r.width >= 8 && r.height >= 8 && (r.width < 44 || r.height < 44) && !el.matches('[type=checkbox],[type=radio]')) tinyTargets.push({ text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 90), class: el.className, width: r.width, height: r.height });
      if ([...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())) {
        const px = s.fontSize; fonts[px] = (fonts[px] || 0) + 1;
        if ((s.overflowX === 'hidden' || s.overflowX === 'clip' || s.overflowY === 'hidden' || s.overflowY === 'clip') && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)) clipCandidates.push({ text: el.textContent.trim().slice(0, 120), class: el.className, font: px, overflow: [el.scrollWidth-el.clientWidth, el.scrollHeight-el.clientHeight], ellipsis: s.textOverflow });
      }
      if (el.matches('button,input,select,textarea') && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth) {
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (hit && !el.contains(hit) && !hit.contains(el) && (!document.querySelector('#sheet[open]') || el.closest('#sheet'))) obstructed.push({ text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 90), by: hit.className || hit.tagName });
      }
    }
    return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1, dialogOpen: !!document.querySelector('#sheet[open]'), dialogCount: document.querySelectorAll('dialog[open]').length, fonts, clipCandidates, tinyTargets, obstructed };
  });
}

/** Capture every scroll interval with 22% overlap, including top and bottom. Also traverses sheets. */
export async function captureScroll(fixture, label, { directory = EVIDENCE, textScale = fixture.textScale, includeDocumentBehindModal = false, fullPage = false } = {}) {
  const { page } = fixture; await mkdir(directory, { recursive: true }); await scaleText(page, textScale);
  const safe = label.replace(/[^a-zA-Z0-9_-]/g, '-'), files = [], samples = [];
  const surfaces = await page.evaluate(include => {
    const result = [], dialog = document.querySelector('#sheet[open]');
    if (!dialog || include) result.push({ kind: 'document', selector: null, height: innerHeight, max: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)-innerHeight });
    if (dialog) {
      for (const [kind, el] of [['sheet', dialog], ['sheet-content', dialog.querySelector('.sheet-content')]]) if (el) { const s = getComputedStyle(el); if (kind === 'sheet' || el.scrollHeight > el.clientHeight + 2 && ['auto','scroll'].includes(s.overflowY)) result.push({ kind, selector: kind === 'sheet' ? '#sheet' : '#sheet .sheet-content', height: el.clientHeight, max: el.scrollHeight - el.clientHeight }); }
    }
    return result;
  }, includeDocumentBehindModal);
  for (const surface of surfaces) {
    const steps = [0], step = Math.max(80, Math.round(surface.height * .78));
    for (let y = step; y < surface.max; y += step) steps.push(y);
    if (surface.max > 0) steps.push(surface.max);
    for (const [i, y] of [...new Set(steps)].entries()) {
      await page.evaluate(({selector,y}) => { if(selector)document.querySelector(selector).scrollTop=y; else window.scrollTo({top:y,behavior:'instant'}); }, { selector: surface.selector, y }); await settle(page, 80);
      const name = `${safe}-${surface.kind}-${String(i).padStart(2,'0')}-${i === 0 ? 'top' : y === surface.max ? 'bottom' : 'scroll'}.png`, output = path.join(directory, name);
      await page.screenshot({ path: output, fullPage: false, animations: 'disabled' }); files.push(output); samples.push({ file: output, surface: surface.kind, scroll: y, diagnostics: await diagnostics(page) });
    }
  }
  if (fullPage) { const output = path.join(directory, `${safe}-full.png`); await page.screenshot({ path: output, fullPage: true, animations: 'disabled' }); files.push(output); }
  const sourceHashes=Object.fromEntries(await Promise.all(['dist/index.html','dist/update.html','dist/studio.js','dist/life-ui.js','dist/life.css','dist/health-ui.css','dist/training-body-ui.css','dist/life-settings-ui.css','dist/typography.css','dist/assets/noto-sans-latin.woff2','dist/integrations/watch-ui.js'].map(async name=>[name,createHash('sha256').update(await readFile(path.join(ROOT,name))).digest('hex')])));
  const manifest = { label, createdAt:new Date().toISOString(), sourceHashes, url: page.url(), textScale, files, samples, pageErrors: fixture.errors.slice(), blockedRequests: fixture.blocked.slice(), writes: fixture.writes.slice(), serviceWorker: 'isolated mock lifecycle; no worker installed' };
  await writeFile(path.join(directory, `${safe}.json`), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/** Capture real-motion transition frames; ordinary scroll evidence disables animations only during capture. */
export async function captureTransition(fixture, label, trigger, { directory = EVIDENCE, intervals = [0,80,160,320,650] } = {}) {
  await mkdir(directory, { recursive:true }); const files = []; await trigger(); let elapsed = 0;
  for(const ms of intervals){ if(ms>elapsed)await fixture.page.waitForTimeout(ms-elapsed); elapsed=ms; const file=path.join(directory,`${label}-motion-${ms}.png`);await fixture.page.screenshot({path:file});files.push(file); }
  return files;
}

export async function openAction(fixture, selector) { await fixture.page.locator(selector).first().click(); await fixture.page.locator('#sheet[open]').waitFor(); await settle(fixture.page); }
export async function expandDetails(page, selector = '#sheet details') { if(!await page.locator(selector).count())throw Error('No disclosure matches audit selector: '+selector);await page.locator(selector).evaluateAll(nodes => nodes.forEach(n => { n.open = true; })); await settle(page); }
export async function closeSheet(page) { if(await page.locator('#sheet[open]').count()){ await page.locator('#sheet [data-act=close-sheet]').first().click(); if(await page.locator('.discard-confirm:not([hidden])').count())await page.locator('[data-act=discard]').click(); await page.locator('#sheet[open]').waitFor({state:'hidden'}); } }
export async function simulateKeyboard(fixture, selector = '#sheet input:not([type=checkbox]):not([type=radio]),#sheet textarea', height = 500) {
  const {page}=fixture,viewport=page.viewportSize();
  const field=page.locator(selector).first();if(!await field.count())return false;
  await page.setViewportSize({width:viewport.width,height:Math.max(924,height+300)});
  await field.focus();await page.setViewportSize({width:viewport.width,height});await settle(page,100);return true;
}

// Auditors must visually inspect PNGs. No DOM pass or numeric score implies visual approval.
