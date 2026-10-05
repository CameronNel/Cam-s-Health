import {today as todayIn, totals, shiftDate, dayFor, round, nextSession} from '../../dist/model.js';
import {validateLifeHealth, healthInsights, prepareHealthProposal} from '../../dist/health-intelligence.js';
import {createLifeState, validateLifeState, upsertTask, toggleTask, removeTask, mergeDeliveries, markDeliveryPickedUp, stableId, factOfDay, FACTS, toggleFactFavorite} from '../../dist/life-model.js';
import {buildTurns, sanitize, insightsPrompt} from './ai.js';
import {discover, createGateway, gmailTools, scanPrompt, cleanupPrompt, SERVER} from './gmail.js';

const TZ = 'Europe/Amsterdam';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const $ = (s, r = document) => r.querySelector(s);
const clone = v => structuredClone(v);
const fmtN = v => v == null ? '—' : Number(v).toLocaleString('en-GB', {maximumFractionDigits: 1});
const dateLabel = d => new Intl.DateTimeFormat('en-GB', {weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'}).format(new Date(d + 'T12:00:00Z'));
const short = d => new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'}).format(new Date(d + 'T12:00:00Z'));

const S = {
  tab: 'today', date: todayIn(TZ), data: null, dataState: 'loading', sync: {dirty: {}, lastSyncedAt: null},
  life: createLifeState(), lifeState: 'loading', uid: null,
  chat: [], busy: null, photo: null, insights: null, factOffset: 0,
  mail: {state: 'idle', tools: null, digest: null, cleanup: null, busy: null, note: '', confirm: null, lastScan: null},
  sheet: null, toast: '', caps: {}, errors: {}
};
let db, sample, mcp, downloads, userCap, ctl, meta = null, days = {}, lifeRef;

const icons = {
  today: '<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  health: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  ask: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H11l-5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  inbox: '<path d="M4 13V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7m-16 0v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5m-16 0h4.5a3.5 3.5 0 0 0 7 0H20"/>',
  life: '<path d="M5 12.5 10 17.5 19 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  photo: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  send: '<path d="M4 12 20 4l-4 16-4-6.5z"/>',
  left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>'
};
const ico = (n, w = 22) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n]}</svg>`;

/* ---------- data assembly ---------- */
function assemble() {
  if (!meta) return null;
  const data = {schemaVersion: 1, updatedAt: meta.updatedAt, profile: meta.profile, training: meta.training, days: clone(days)};
  if (meta.recipes) data.recipes = meta.recipes;
  if (meta.provenance) data.provenance = meta.provenance;
  return data;
}
function refreshData() {
  const data = assemble();
  if (!data) { S.dataState = 'empty'; S.data = null; }
  else try { S.data = validateLifeHealth(data); S.dataState = 'ready'; } catch (e) { S.data = null; S.dataState = 'error'; S.errors.data = e.message; }
  schedule();
}
const nowISO = () => new Date().toISOString();

/* ---------- rendering ---------- */
let raf = 0;
function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }
function toast(msg) { S.toast = msg; schedule(); setTimeout(() => { if (S.toast === msg) { S.toast = ''; schedule(); } }, 3200); }

function render() {
  const app = $('#app');
  const tabs = [['today', 'Today'], ['health', 'Health'], ['ask', 'Ask'], ['inbox', 'Inbox'], ['life', 'Life']];
  const keep = $('main')?.scrollTop ?? 0, tabChanged = app.dataset.tab !== S.tab;
  const composerText = $('#msg')?.value ?? '';
  const view = {today: vToday, health: vHealth, ask: vAsk, inbox: vInbox, life: vLife}[S.tab]();
  app.dataset.tab = S.tab;
  app.innerHTML = `<header><div class="brand">Cam’s Life<small>${esc(S.data ? (Object.keys(S.sync.dirty).length ? `${Object.keys(S.sync.dirty).length} day(s) not yet in GitHub` : 'Synced with GitHub copy') : 'Loading')}</small></div><button class="hbtn" data-act="settings" aria-label="Settings">${ico('gear')}</button></header>
  <main id="view">${view}</main>
  ${S.tab === 'ask' ? composer() : ''}
  <nav aria-label="Sections">${tabs.map(([k, l]) => `<button data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${ico(k)}<span>${l}</span></button>`).join('')}</nav>
  ${S.sheet ? `<div class="sheet-bg" data-act="closesheet"><div class="sheet" role="dialog" aria-modal="true" data-stop>${sheet()}</div></div>` : ''}
  ${S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : ''}`;
  const main = $('main');
  if (!tabChanged) main.scrollTop = S.tab === 'ask' && S.stickBottom ? main.scrollHeight : keep;
  if (S.tab === 'ask') { const m = $('#msg'); if (m) { m.value = composerText; autosize(m); } if (S.stickBottom) main.scrollTop = main.scrollHeight; }
}

function offline(msg) { return `<div class="card"><h2>${esc(msg)}</h2></div>`; }

function dayNav() {
  return `<div class="row between"><button class="hbtn" data-act="day" data-n="-1" aria-label="Previous day">${ico('left')}</button><button class="grow btn quiet" data-act="daytoday" style="min-height:44px">${esc(dateLabel(S.date))}${S.date === todayIn(TZ) ? ' · today' : ''}</button><button class="hbtn" data-act="day" data-n="1" aria-label="Next day">${ico('right')}</button></div>`;
}

function stateGate() {
  if (!S.caps.db) return offline('Private storage is unavailable. Open this page from claude.ai while signed in.');
  if (S.dataState === 'loading') return `<div class="card muted">Loading your records…</div>`;
  if (S.dataState === 'empty') return `<div class="card col"><h2>No health records yet</h2><p class="muted">Your records are imported once from <b>dist/data/health.json</b> on GitHub into this app’s private store. Ask Claude Code to import them, then reopen this page.</p></div>`;
  if (S.dataState === 'error') return `<div class="card col"><h2 class="err">Stored records failed validation</h2><p class="muted">${esc(S.errors.data)}</p><p class="muted small">Nothing was changed. Ask Claude Code to repair the record.</p></div>`;
  return '';
}

function macroBar(label, v, t, unit = 'g') {
  const pct = t ? Math.min(100, (v / t) * 100) : 0;
  return `<div class="macro"><div class="faint small">${label}</div><b>${fmtN(v)}</b><span class="faint small"> / ${t ?? '—'} ${unit}</span><div class="bar"><i class="${t && v > t ? 'over' : ''}" style="width:${pct}%"></i></div></div>`;
}

function vToday() {
  const gate = stateGate(); if (gate) return gate;
  const d = S.data, day = dayFor(d, S.date), t = totals(day), tg = d.profile.targets, ins = healthInsights(d, S.date);
  const logged = day.food.length > 0, left = logged && tg.kcal != null ? round(tg.kcal - t.kcal) : null;
  const next = ins.nextSession, trainingHold = ['awaiting clearance', 'paused'].includes(d.profile.trainingStatus);
  const done = day.workouts.filter(w => w.status === 'completed');
  const open = S.life.tasks.filter(x => x.status === 'open'), pkgs = S.life.deliveries.filter(x => ['ordered', 'in_transit', 'ready_for_pickup'].includes(x.status));
  const fact = factOfDay(S.date, {favorites: S.life.favorites});
  return `${dayNav()}
  <section class="card col"><div class="eyebrow">Fuel${t.pending ? ' · incomplete' : t.estimated ? ' · includes estimates' : ''}</div>
    ${logged ? `<div class="num">${left >= 0 ? fmtN(left) : fmtN(-left)}<small>kcal ${left >= 0 ? 'left' : 'over target'} · ${fmtN(t.kcal)} logged${t.pending ? ' so far (some entries have no nutrition yet)' : ''}</small></div>` : `<div class="num" style="font-size:28px">Food not logged</div><p class="muted small">An empty day is unknown, not zero.</p>`}
    <div class="macros">${macroBar('Protein', t.protein, tg.protein)}${macroBar('Carbs', t.carbs, tg.carbs)}${macroBar('Fat', t.fat, tg.fat)}</div>
    <button class="btn" data-act="goask">Log with Claude</button></section>
  <section class="card col"><div class="eyebrow">Movement</div>
    <div class="row between"><div><div class="num" style="font-size:30px">${day.steps == null ? 'not logged' : fmtN(day.steps)}</div><div class="faint small">steps${tg.steps ? ' of ' + fmtN(tg.steps) : ''}</div></div><div style="text-align:right"><div class="t" style="font-weight:600">${done.length ? esc(done.map(w => w.name + (w.durationMin != null ? ` · ${w.durationMin} min` : '')).join(', ')) : 'No workout logged'}</div><div class="faint small">${trainingHold ? 'Training status: ' + esc(d.profile.trainingStatus) : next ? 'Next: ' + esc(next.name) : ''}</div></div></div></section>
  ${open.length || pkgs.length ? `<section class="card col"><div class="eyebrow">Needs you</div>${open.slice(0, 3).map(x => `<div class="row"><span class="pill">to-do</span><span class="grow">${esc(x.title)}</span>${x.dueDate ? `<span class="faint small">${esc(short(x.dueDate))}</span>` : ''}</div>`).join('')}${pkgs.slice(0, 3).map(p => `<div class="row"><span class="pill ${p.status === 'ready_for_pickup' ? 'est' : ''}">${p.status === 'ready_for_pickup' ? 'pickup' : 'package'}</span><span class="grow">${esc(p.title)}</span>${p.pickupDeadline ? `<span class="faint small">by ${esc(short(p.pickupDeadline))}</span>` : ''}</div>`).join('')}<button class="btn quiet sm" data-act="tab" data-tab="life">Open Life</button></section>` : ''}
  ${factCard(fact)}`;
}

function factCard(f) {
  return `<section class="card fact"><div class="row between"><span class="eyebrow">${esc(f.category)} · daily fact</span><button class="btn sm quiet" data-act="fav" data-id="${esc(f.id)}" aria-pressed="${f.favorite}">${f.favorite ? 'Saved' : 'Save'}</button></div><h3>${esc(f.title)}</h3><p class="muted">${esc(f.body)}</p><p class="small" style="margin-top:8px"><a href="${esc(f.sourceURL)}" target="_blank" rel="noopener noreferrer">${esc(f.sourceTitle)}</a></p></section>`;
}

/* ---------- charts ---------- */
function chart(points, {kind = 'line', target = null, proj = null, unit = '', dim = () => false, label = ''}) {
  if (!points.length) return '<div class="empty small">Nothing recorded in this range yet. Gaps stay empty.</div>';
  const W = 320, H = 150, L = 36, R = 10, T = 12, B = 22;
  const vals = points.map(p => p.value).concat(target != null ? [target] : [], proj ? [proj.value] : []);
  let min = kind === 'bars' ? 0 : Math.min(...vals), max = Math.max(...vals);
  if (kind === 'bars') max = max * 1.12 || 1; else { const pad = Math.max((max - min) * .18, 0.5); min -= pad; max += pad; }
  const t0 = Date.parse(points[0].date), t1 = Date.parse(proj ? proj.date : points.at(-1).date), span = Math.max(t1 - t0, 86400000);
  const x = d => L + (Date.parse(d) - t0) / span * (W - L - R - (kind === 'bars' ? 10 : 0)) + (kind === 'bars' ? 5 : 0);
  const y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const ticks = [min, (min + max) / 2, max].map(v => Math.round(v * 10) / 10);
  const bw = Math.max(4, Math.min(18, (W - L - R) / (span / 86400000 + 1) * .62));
  let g = ticks.map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtN(v)}</text>`).join('');
  if (kind === 'bars') g += points.map(p => `<rect class="bar-m ${dim(p) ? 'dim' : ''}" x="${x(p.date) - bw / 2}" y="${y(p.value)}" width="${bw}" height="${Math.max(1, H - B - y(p.value))}" rx="3"><title>${esc(short(p.date))}: ${fmtN(p.value)} ${unit}</title></rect>`).join('');
  else {
    g += `<polyline class="line-m" points="${points.map(p => `${x(p.date)},${y(p.value)}`).join(' ')}"/>`;
    g += points.map((p, i) => `<circle class="dot ${i === points.length - 1 ? 'last' : ''}" cx="${x(p.date)}" cy="${y(p.value)}" r="${i === points.length - 1 ? 4.5 : 3}"><title>${esc(short(p.date))}: ${fmtN(p.value)} ${unit}</title></circle>`).join('');
    if (proj) { const l = points.at(-1); g += `<line class="proj" x1="${x(l.date)}" y1="${y(l.value)}" x2="${x(proj.date)}" y2="${y(proj.value)}"/><circle class="dot last" cx="${x(proj.date)}" cy="${y(proj.value)}" r="3" fill="none" stroke="var(--yellow)"/>`; }
  }
  if (target != null) g += `<line class="tgt" x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}"/><text class="tl" x="${W - R}" y="${y(target) - 5}" text-anchor="end">target ${fmtN(target)}</text>`;
  g += `<text x="${L}" y="${H - 5}">${esc(short(points[0].date))}</text><text x="${W - R}" y="${H - 5}" text-anchor="end">${esc(short(proj ? proj.date : points.at(-1).date))}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}: ${points.length} recorded values from ${esc(points[0].date)} to ${esc(points.at(-1).date)}">${g}</svg>`;
}

const series = (d, date, range, pick) => Object.entries(d.days).filter(([k]) => k > shiftDate(date, -range) && k <= date).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({date: k, value: pick(v, k), day: v})).filter(p => Number.isFinite(p.value));

function vHealth() {
  const gate = stateGate(); if (gate) return gate;
  const d = S.data, day = dayFor(d, S.date), t = totals(day), tg = d.profile.targets, ins = healthInsights(d, S.date), wt = ins.weightTrend;
  const kcal = series(d, S.date, 14, v => v.food.length ? totals(v).kcal : NaN);
  const steps = series(d, S.date, 14, v => v.steps ?? NaN);
  const sleep = series(d, S.date, 14, v => v.wellbeing?.sleepHours ?? NaN);
  const bf = series(d, S.date, 60, v => v.body?.bodyFatPct ?? NaN), mu = series(d, S.date, 60, v => v.body?.skeletalMuscleKg ?? NaN);
  const w = series(d, S.date, 30, v => v.weightKg ?? NaN);
  const next = ins.nextSession, hold = ['awaiting clearance', 'paused'].includes(d.profile.trainingStatus);
  const ai = S.insights;
  return `${dayNav()}
  <section class="card col"><div class="row between"><h2>Food</h2>${t.pending ? '<span class="pill warn">incomplete</span>' : t.estimated ? '<span class="pill est">estimates</span>' : ''}</div>
    ${day.food.length ? `<div class="list">${day.food.map(f => `<div class="item"><div class="grow"><div class="t">${esc(f.name)}</div><div class="faint small">${esc(f.quantity || 'quantity not given')}</div>${f.note ? `<div class="entry-note">${esc(f.note)}</div>` : ''}</div><div style="text-align:right;font-variant-numeric:tabular-nums">${f.kcal == null ? '<span class="pill warn">nutrition unknown</span>' : `<b>${fmtN(f.kcal)}</b> <span class="faint small">kcal</span><div class="faint small">P ${fmtN(f.protein)} · C ${fmtN(f.carbs)} · F ${fmtN(f.fat)}</div>`}${f.estimated ? '<div><span class="pill est">estimate</span></div>' : ''}${f.reviewRequired ? '<div><span class="pill warn">check macros</span></div>' : ''}</div></div>`).join('')}</div>` : '<p class="muted">Nothing logged for this day.</p>'}
    <div class="row" style="gap:8px"><span class="faint small grow">${fmtN(t.kcal)} / ${tg.kcal ?? '—'} kcal · P ${fmtN(t.protein)} / ${tg.protein ?? '—'} g</span><button class="btn sm" data-act="goask">Log with Claude</button></div></section>
  <section class="card col"><h2>Calories vs target</h2>${chart(kcal.map(p => ({...p, pending: totals(p.day).pending})), {kind: 'bars', target: tg.kcal, unit: 'kcal', dim: p => p.pending > 0, label: 'Calories'})}<div class="legend"><span><i style="background:var(--sage)"></i>logged</span><span><i style="background:var(--sage-deep)"></i>incomplete day</span></div></section>
  <section class="card col"><h2>Steps vs target</h2>${chart(steps, {kind: 'bars', target: tg.steps, unit: 'steps', label: 'Steps'})}</section>
  <section class="card col"><h2>Weight</h2>${chart(w, {proj: wt.projection, unit: 'kg', label: 'Weight'})}<p class="muted small">${wt.enoughReadings ? esc(`${wt.perWeek > 0 ? '+' : ''}${wt.perWeek} kg per week across ${wt.count} readings. Dashed line: ${wt.projection?.label || ''}`) : 'A trend line needs at least five reading dates across a week. Until then nothing is extrapolated.'}</p></section>
  <section class="card col"><h2>Body composition</h2>${chart(bf, {unit: '%', label: 'Body fat'})}<div class="eyebrow">Body fat %</div>${chart(mu, {unit: 'kg', label: 'Skeletal muscle'})}<div class="eyebrow">Reported skeletal muscle, kg</div><p class="muted small">Readings from different devices are not blended. ${bf.at(-1) ? 'Latest method: ' + esc(bf.at(-1).day.body.method || 'Not specified') + '.' : ''}</p></section>
  <section class="card col"><h2>Sleep</h2>${chart(sleep, {kind: 'bars', unit: 'h', label: 'Sleep hours'})}</section>
  <section class="card col"><div class="row between"><h2>Insights</h2><button class="btn sm primary" data-act="analyze" ${S.busy === 'analyze' || !S.caps.sample ? 'disabled' : ''}>${S.busy === 'analyze' ? 'Thinking…' : ai ? 'Refresh' : 'Ask Claude'}</button></div>
    ${ins.insights.map(i => `<div class="item"><span class="pill ${i.tone === 'attention' ? 'warn' : i.tone === 'positive' ? 'ok' : ''}">${esc(i.tone)}</span><div class="grow"><div class="t">${esc(i.title)}</div><div class="faint small">${esc(i.detail)}</div></div></div>`).join('')}
    ${ai ? `<div class="eyebrow" style="margin-top:6px">Claude · ${esc(short(ai.date))}</div><p>${esc(ai.headline)}</p>${(ai.insights || []).map(i => `<div class="item"><span class="pill ${i.tone === 'attention' ? 'warn' : i.tone === 'positive' ? 'ok' : ''}">${esc(i.tone || 'note')}</span><div class="grow"><div class="t">${esc(i.title)}</div><div class="faint small">${esc(i.detail)}</div></div></div>`).join('')}${(ai.concerns || []).map(i => `<div class="item"><span class="pill warn">concern</span><div class="grow"><div class="t">${esc(i.title)}</div><div class="faint small">${esc(i.detail)}</div></div></div>`).join('')}${(ai.nextSteps || []).length ? `<div class="eyebrow">Next small steps</div><ul class="muted" style="margin:0;padding-left:18px">${ai.nextSteps.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<p class="faint small">Based on logged days only. Not medical advice.</p>` : ''}
    ${S.errors.analyze ? `<p class="err small">${esc(S.errors.analyze)}</p>` : ''}</section>
  <section class="card col"><h2>Training</h2>${hold ? `<p class="muted">Status: <b>${esc(d.profile.trainingStatus)}</b>. ${esc(d.profile.trainingNote || '')}</p>` : next ? `<div class="t" style="font-weight:600">${esc(next.name)} <span class="faint">· ${esc(next.focus || '')}</span></div><div class="list">${next.exercises.map(e => `<div class="item"><div class="grow"><div class="t">${esc(e.name)}</div>${e.note ? `<div class="entry-note">${esc(e.note)}</div>` : ''}</div><div class="faint small" style="text-align:right">${esc(e.sets ?? '')} × ${esc(e.reps ?? '')}</div></div>`).join('')}</div>` : '<p class="muted">No session proposed.</p>'}</section>`;
}

/* ---------- Ask (real Claude) ---------- */
function composer() {
  const can = S.caps.sample && S.dataState === 'ready';
  return `<div id="composer">${S.photo ? `<div class="row small muted" style="margin-bottom:6px"><span class="pill">photo attached</span><span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(S.photo.name)}</span><button class="btn sm quiet" data-act="rmphoto">Remove</button></div>` : ''}
  <div class="box"><button class="attach" data-act="photo" aria-label="Attach a photo" ${can && S.caps.images ? '' : 'disabled'}>${ico('photo')}</button><textarea id="msg" rows="1" placeholder="${can ? 'I ate 100 g chicken, very overcooked…' : 'Claude is unavailable here'}" ${can ? '' : 'disabled'} enterkeyhint="send"></textarea>${S.busy === 'ask' ? `<button class="send" data-act="stop" aria-label="Stop" style="background:var(--raised);color:var(--cream)">■</button>` : `<button class="send" data-act="send" aria-label="Send" ${can ? '' : 'disabled'}>${ico('send')}</button>`}</div><input type="file" id="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden></div>`;
}
function autosize(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; }

function proposalCard(m, i) {
  const p = m.proposal;
  if (!p) return '';
  if (m.saved) return `<div style="margin-top:10px"><span class="pill ok">Saved to your records</span></div><div style="margin-top:8px;white-space:pre-wrap" class="muted small">${esc(m.saved)}</div>`;
  if (m.discarded) return '<div style="margin-top:10px"><span class="pill">Discarded</span></div>';
  return `<div style="margin-top:10px"><div class="eyebrow">Proposed changes · ${esc(dateLabel(m.date))}</div>${p.changes.map(c => `<div class="change"><span>${esc(c.label)}</span><span class="v">${c.kind === 'append' ? esc(entrySummary(c.after)) : c.kind === 'edit' ? esc(entrySummary(c.after)) : `${c.before == null ? '' : `<span class="b">${esc(fmtN(c.before))}</span>`}${esc(typeof c.after === 'number' ? fmtN(c.after) : c.after ?? 'cleared')}`}</span></div>`).join('')}${m.saveError ? `<p class="err small" style="margin-top:8px">${esc(m.saveError)}</p>` : ''}<div class="row" style="margin-top:12px"><button class="btn primary grow" data-act="save" data-i="${i}" ${S.busy ? 'disabled' : ''}>${S.busy === 'save' ? 'Saving…' : 'Save'}</button><button class="btn quiet" data-act="discard" data-i="${i}">Discard</button></div></div>`;
}
const entrySummary = e => e.kcal !== undefined ? `${e.quantity ? e.quantity + ' · ' : ''}${e.kcal == null ? 'nutrition unknown' : `${fmtN(e.kcal)} kcal · P ${fmtN(e.protein)} C ${fmtN(e.carbs)} F ${fmtN(e.fat)}`}${e.estimated ? ' · est.' : ''}` : `${e.status}${e.durationMin != null ? ' · ' + e.durationMin + ' min' : ''}`;

function vAsk() {
  const gate = stateGate();
  const intro = `<div class="card col"><h2>Tell Claude what happened</h2><p class="muted">Describe meals, weight, watch readings, sleep, mood or a workout in your own words. Claude estimates what’s missing and states its assumptions. You review, then one tap saves.</p><div class="chip-row">${['I ate 100 g chicken that was extremely overcooked', 'Weight 65.2 kg, body fat 12.8% on my watch', 'Slept 7.5 hours, mood 4/5, energy 3/5', 'What are we training today?'].map(x => `<button class="btn sm quiet" data-act="prompt" data-p="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`;
  const msgs = S.chat.map((m, i) => m.role === 'user' ? `<div class="bubble u">${m.photo ? '<span class="pill">photo</span> ' : ''}${esc(m.content)}</div>` : `<div class="bubble a">${esc(m.content)}${(m.questions || []).length ? `<div style="margin-top:8px" class="muted">${m.questions.map(q => `<div>• ${esc(q)}</div>`).join('')}</div>` : ''}${proposalCard(m, i)}${m.error ? `<p class="err small">${esc(m.error)}</p>` : ''}</div>`).join('');
  return `${!S.caps.sample ? '<div class="card"><h2 class="err">Claude isn’t available in this view</h2><p class="muted">Open the app inside claude.ai and allow it to use Claude when asked.</p></div>' : ''}${gate}${S.chat.length ? '' : intro}${msgs}${S.busy === 'ask' ? `<div class="bubble a"><div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span>Claude is working it out…</span></div></div>` : ''}`;
}

async function ask(text) {
  if (!S.caps.sample || S.busy || S.dataState !== 'ready') return;
  text = text.trim();
  if (!text && !S.photo) return;
  const photo = S.photo;
  S.chat.push({role: 'user', content: text || '(photo)', photo: !!photo});
  S.busy = 'ask'; S.stickBottom = true; S.photo = null; schedule();
  ctl = new AbortController();
  try {
    const history = S.chat.slice(0, -1).filter(m => m.content).map(m => ({role: m.role, content: m.role === 'assistant' ? m.content + (m.actionsJSON ? `\n[actions proposed: ${m.actionsJSON}]` : '') : m.content}));
    while (history.length && history[0].role !== 'user') history.shift();
    const turns = buildTurns(S.data, S.date, history, text);
    const parsed = await sample.json(turns, {cache: false, signal: ctl.signal, ...(photo ? {images: [photo]} : {})});
    const r = sanitize(parsed, S.date);
    const entry = {role: 'assistant', content: r.reply || 'Done.', questions: r.questions, date: r.date, actionsJSON: r.actions.length ? JSON.stringify(r.actions).slice(0, 1500) : ''};
    if (r.actions.length) {
      try {
        const base = r.date === S.date ? S.data : await withDay(r.date);
        entry.proposal = prepareHealthProposal(base, r.date, r.actions);
        if (!entry.proposal.changes.length) { entry.proposal = null; entry.content += '\n\n(That matches what is already recorded, so nothing needs saving.)'; }
      } catch (e) { entry.error = `I couldn’t turn that into a valid record: ${e.message}`; }
    }
    S.chat.push(entry);
  } catch (e) {
    if (e.code !== 'cancelled') S.chat.push({role: 'assistant', content: '', error: sampleError(e)});
  } finally { S.busy = null; S.stickBottom = true; schedule(); }
}
async function withDay(date) { const snap = await db.doc(`days/${date}`).get(), base = clone(S.data); if (snap.exists) base.days[date] = clone(snap.data()); return base; }
const sampleError = e => ({not_granted: 'Claude access was declined for this view. Reload and allow it to continue.', rate_limited: 'Claude is rate-limited right now. Try again in a little while.', invalid_json: 'Claude’s answer could not be read. Try rephrasing, or send fewer items at once.', session_expired: 'Your claude.ai session expired. Sign in again.', refused: 'Claude declined that input.', images_unavailable: 'Photos are not supported in this view.', image_rejected: 'That photo could not be used. Try a JPEG or PNG under 20 MB.', prompt_too_large: 'That was too much to send at once.'}[e.code] || `Claude couldn’t finish (${e.code || 'error'}). Nothing was changed.`);

async function saveProposal(i) {
  const m = S.chat[i];
  if (!m?.proposal || S.busy) return;
  S.busy = 'save'; m.saveError = ''; schedule();
  try {
    const date = m.date, ref = db.doc(`days/${date}`);
    const snap = await ref.get(), base = clone(S.data);
    if (snap.exists) base.days[date] = clone(snap.data()); else delete base.days[date];
    const result = m.proposal.apply(base);
    result.updatedAt = nowISO();
    validateLifeHealth(result);
    await ref.set(result.days[date]);
    await db.doc('health/meta').update({updatedAt: result.updatedAt});
    const syncRef = db.doc('health/sync');
    try { await syncRef.update({dirty: {[date]: result.updatedAt}}); } catch { await syncRef.set({dirty: {[date]: result.updatedAt}, lastSyncedAt: null}); }
    const back = await ref.get();
    if (JSON.stringify(back.data()) !== JSON.stringify(result.days[date])) throw Error('Read-back did not match. Refresh before trying again.');
    const ins = healthInsights({...base, days: {...base.days, [date]: back.data()}, updatedAt: result.updatedAt}, date), t = ins.nutrition, tg = result.profile.targets;
    const dd = back.data();
    m.saved = `${dateLabel(date)} · ${dd.food.length ? `${fmtN(t.kcal)} / ${tg.kcal} kcal (${fmtN(round(tg.kcal - t.kcal))} left) · P ${fmtN(t.protein)} C ${fmtN(t.carbs)} F ${fmtN(t.fat)}${t.pending ? ' · some entries incomplete' : t.estimated ? ' · includes estimates' : ''}` : 'food not logged'} · steps ${dd.steps == null ? 'not logged' : fmtN(dd.steps)} · ${dd.workouts.length ? dd.workouts.map(w => w.name + (w.durationMin != null ? ` ${w.durationMin} min` : '')).join(', ') : 'training not logged'}${ins.nextSession && !['awaiting clearance', 'paused'].includes(result.profile.trainingStatus) ? ` · next: ${ins.nextSession.name}` : ''}`;
    S.date = date; toast('Saved');
  } catch (e) { m.saveError = e.message; }
  finally { S.busy = null; schedule(); }
}

async function analyze() {
  if (!S.caps.sample || S.busy) return;
  S.busy = 'analyze'; S.errors.analyze = ''; schedule();
  try {
    const out = await sample.json(insightsPrompt(S.data, S.date), {modelTier: 'default', cache: {gcTime: 3600000}});
    S.insights = {...out, date: S.date};
  } catch (e) { S.errors.analyze = sampleError(e); }
  finally { S.busy = null; schedule(); }
}

/* ---------- Inbox ---------- */
function mailBanner() {
  const m = S.mail;
  if (!S.caps.mcp) return '<div class="card"><h2>Gmail is unavailable in this view</h2><p class="muted">Open this app inside claude.ai to use your Gmail connector.</p></div>';
  if (m.state === 'idle') return '<div class="card col"><h2>Connect through Claude</h2><p class="muted">This app uses the Gmail connector in your claude.ai account. No Google Cloud project is needed.</p><button class="btn primary" data-act="mailcheck">Check Gmail connection</button></div>';
  if (m.state === 'checking') return '<div class="card muted">Checking…</div>';
  if (m.state === 'server_not_connected') return '<div class="card col"><h2>Gmail isn’t connected yet</h2><p class="muted">In claude.ai go to Settings → Connectors, add <b>Gmail</b>, sign in with your Google account, then reload this page.</p><button class="btn" data-act="mailcheck">Check again</button></div>';
  if (m.state === 'needs_reauth') return '<div class="card col"><h2>Reconnect Gmail</h2><p class="muted">Your Gmail connection expired. Reconnect it in claude.ai Settings → Connectors.</p><button class="btn" data-act="mailcheck">Check again</button></div>';
  if (m.state !== 'ready') return `<div class="card col"><h2 class="err">Gmail check failed</h2><p class="muted">${esc(m.note || m.state)}</p><button class="btn" data-act="mailcheck">Try again</button></div>`;
  return '';
}

function vInbox() {
  const m = S.mail, banner = mailBanner();
  if (m.state !== 'ready') return banner;
  const tl = m.tools, canMod = !!(tl.removeLabel || tl.trash);
  const dg = m.digest;
  const group = (k, label) => { const rows = (dg?.messages || []).filter(x => x.category === k); return rows.length ? `<section class="card col"><div class="row between"><h2>${label}</h2><span class="pill">${rows.length}</span></div><div class="list">${rows.map(x => `<div class="item"><div class="grow"><div class="t">${x.unread ? '● ' : ''}${esc(x.subject || '(no subject)')}</div><div class="faint small">${esc(x.from)} ${x.date ? '· ' + esc(short(String(x.date).slice(0, 10))) : ''}</div><div class="entry-note">${esc(x.summary || '')}</div></div></div>`).join('')}</div></section>` : ''; };
  return `<section class="card col"><div class="row between"><h2>Inbox brief</h2><span class="pill ok">connected</span></div>
    ${dg ? `<p>${esc(dg.summary)}</p><p class="faint small">Scanned ${esc(m.lastScan || '')}. Mail stays in your private store, never in GitHub.</p>` : '<p class="muted">Summarise recent mail, pull out to-dos and track packages.</p>'}
    <div class="row"><select id="scandays" aria-label="Days to scan" style="width:auto"><option value="3">Last 3 days</option><option value="7" selected>Last 7 days</option><option value="14">Last 14 days</option></select><button class="btn primary grow" data-act="scan" ${m.busy || !S.caps.sample ? 'disabled' : ''}>${m.busy === 'scan' ? 'Reading…' : 'Scan inbox'}</button></div>
    ${m.busy ? `<div class="thinking small"><span class="dots"><i></i><i></i><i></i></span><span>${esc(m.note)}</span></div>` : m.note && m.busy == null ? `<p class="small ${/fail|could/i.test(m.note) ? 'err' : 'muted'}">${esc(m.note)}</p>` : ''}
    <p class="faint small">Briefs run when you open the app. A web page cannot run in the background or send notifications.</p></section>
  ${group('action', 'Needs attention')}${group('update', 'Updates')}${group('noise', 'Likely noise')}
  <section class="card col"><h2>Clean up unread mail</h2><p class="muted small">Describe what you don’t want. You review the matches before anything changes. Nothing is permanently deleted.</p>
    <textarea id="cleanreq" rows="2" placeholder="e.g. unread newsletters and automated GitHub or Codex notices"></textarea>
    <button class="btn" data-act="findclean" ${m.busy || !S.caps.sample ? 'disabled' : ''}>${m.busy === 'clean' ? 'Searching…' : 'Find matches'}</button>
    ${m.cleanup ? `<p>${esc(m.cleanup.summary || '')}</p>${m.cleanup.matches.length ? `<div class="list">${m.cleanup.matches.map((x, i) => `<label class="item"><input type="checkbox" data-sel="${i}" ${x.sel ? 'checked' : ''}><div class="grow"><div class="t">${esc(x.subject || '(no subject)')}</div><div class="faint small">${esc(x.from)}</div><div class="entry-note">${esc(x.reason || '')}</div></div></label>`).join('')}</div>
      ${canMod ? `<div class="row" style="flex-wrap:wrap">${['archive', 'read', 'trash'].map(k => `<button class="btn sm ${k === 'trash' ? 'danger' : ''}" data-act="cleanup" data-k="${k}" ${m.busy || !m.cleanup.matches.some(x => x.sel) ? 'disabled' : ''}>${m.confirm === k ? 'Tap again to confirm' : {archive: 'Archive', read: 'Mark read', trash: 'Move to Trash'}[k]}</button>`).join('')}</div>${m.confirm ? '<p class="small muted">Selected messages will be changed. Trash can be undone in Gmail for 30 days.</p>' : ''}` : '<p class="small err">This Gmail connector exposes no tool to change labels, so cleanup can only be reviewed.</p>'}` : ''}${m.cleanupResult ? `<p class="small ${m.cleanupResult.failed ? 'err' : 'muted'}">${esc(m.cleanupResult.text)}</p>` : ''}` : ''}</section>`;
}

async function mailCheck() {
  S.mail.state = 'checking'; schedule();
  const r = await discover(mcp);
  S.mail.state = r.state; S.mail.tools = r.tools; S.mail.note = r.state === 'ready' ? '' : String(r.state);
  if (r.state === 'ready' && !(r.tools.search && r.tools.read)) { S.mail.state = 'error'; S.mail.note = `Gmail is connected but is missing the search or read tool. Tools found: ${(r.all || []).join(', ')}`; }
  schedule();
}

const JSON_TEXT_LIMIT = 200000;
async function scan() {
  const m = S.mail; if (m.busy) return;
  const days = Number($('#scandays')?.value || 7);
  m.busy = 'scan'; m.note = 'Starting…'; schedule();
  const seen = new Map(), gw = createGateway(mcp, m.tools, seen);
  try {
    const out = await sample.json(scanPrompt(todayIn(TZ), days), {tools: gmailTools(gw, msg => { m.note = msg; schedule(); }), modelTier: 'default'});
    const messages = (Array.isArray(out.messages) ? out.messages : []).map(x => ({id: String(x.id || ''), from: String(x.from || ''), subject: String(x.subject || ''), date: x.date || '', unread: x.unread === true, category: ['action', 'update', 'noise'].includes(x.category) ? x.category : 'update', summary: String(x.summary || '')})).filter(x => x.id);
    const corpus = [...seen.values()].join('\n');
    const now = nowISO(), problems = [];
    // Delivery codes and tracking numbers must appear verbatim in mail Claude actually read.
    const cand = (Array.isArray(out.deliveries) ? out.deliveries : []).map(x => {
      const verify = v => { if (!v) return null; v = String(v).trim(); if (corpus.includes(v)) return v; problems.push(v); return null; };
      const tracking = verify(x.trackingNumber), code = verify(x.pickupCode);
      const status = ['ordered', 'in_transit', 'ready_for_pickup', 'delivered', 'picked_up', 'cancelled', 'unknown'].includes(x.status) ? x.status : 'unknown';
      const dateOk = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null;
      const identity = tracking ? `tracking:${tracking}` : `email:${x.sourceEmailId || x.title}`;
      return {id: stableId('delivery', identity), title: String(x.title || 'Package').slice(0, 200), carrier: x.carrier || null, trackingNumber: tracking, pickupCode: code, pickupDeadline: dateOk(x.pickupDeadline), pickupLocation: x.pickupLocation || null, expectedDelivery: dateOk(x.expectedDelivery), status, sourceEmailIds: x.sourceEmailId ? [String(x.sourceEmailId)] : [], firstSeenAt: now, updatedAt: now, completedAt: null};
    });
    const tasks = (Array.isArray(out.tasks) ? out.tasks : []).filter(x => x?.title);
    await mutateLife(state => {
      let next = {...state, deliveries: mergeDeliveries(state.deliveries, cand)};
      for (const t of tasks) next = upsertTask(next, {title: String(t.title).slice(0, 300), dueDate: /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate || '') ? t.dueDate : null, sourceEmailId: String(t.sourceEmailId || t.title), source: 'email'}, now);
      next.lastDigest = {generatedAt: now, summary: String(out.summary || '').slice(0, 1500), count: messages.length};
      return next;
    });
    m.digest = {summary: String(out.summary || ''), messages}; m.lastScan = new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
    m.note = `${messages.length} messages, ${tasks.length} to-do${tasks.length === 1 ? '' : 's'} found, ${cand.length} package${cand.length === 1 ? '' : 's'}.${problems.length ? ` ${problems.length} detail(s) ignored because they were not found verbatim in the email.` : ''}`;
  } catch (e) { m.note = `Scan could not finish: ${e.code === 'tool_error' || e.code ? sampleError(e) : e.message}`; }
  finally { m.busy = null; schedule(); }
}

async function findClean() {
  const m = S.mail, req = $('#cleanreq')?.value.trim(); if (!req || m.busy) return;
  m.busy = 'clean'; m.cleanup = null; m.cleanupResult = null; m.confirm = null; schedule();
  const seen = new Map(), gw = createGateway(mcp, m.tools, seen);
  try {
    const out = await sample.json(cleanupPrompt(req, todayIn(TZ)), {tools: gmailTools(gw), modelTier: 'default'});
    m.cleanup = {summary: String(out.summary || ''), matches: (Array.isArray(out.matches) ? out.matches : []).filter(x => x?.id).slice(0, 40).map(x => ({id: String(x.id), from: String(x.from || ''), subject: String(x.subject || ''), reason: String(x.reason || ''), sel: true}))};
  } catch (e) { m.cleanupResult = {failed: 1, text: `Search could not finish: ${sampleError(e)}`}; }
  finally { m.busy = null; schedule(); }
}

async function cleanup(kind) {
  const m = S.mail, ids = (m.cleanup?.matches || []).filter(x => x.sel);
  if (!ids.length || m.busy) return;
  if (m.confirm !== kind) { m.confirm = kind; schedule(); return; }
  m.confirm = null; m.busy = 'apply'; schedule();
  const gw = createGateway(mcp, m.tools, new Map());
  let ok = 0, failed = 0, first = '';
  for (const x of ids) { try { await gw.modify(x.id, kind); ok++; } catch (e) { failed++; first ||= e.message; } }
  m.cleanup.matches = m.cleanup.matches.filter(x => !(x.sel && ids.includes(x)));
  m.cleanupResult = {failed, text: `${ok} message${ok === 1 ? '' : 's'} ${{archive: 'archived', read: 'marked read', trash: 'moved to Trash'}[kind]}${failed ? `; ${failed} failed (${first})` : ''}.`};
  m.busy = null; schedule();
}

/* ---------- Life ---------- */
let lifeQueue = Promise.resolve();
function mutateLife(fn) {
  const run = async () => {
    const snap = await lifeRef.get();
    const base = createLifeState(snap.exists ? clone(snap.data()) : {});
    const next = validateLifeState(fn(base));
    await lifeRef.set(next); S.life = next; S.lifeState = 'ready'; schedule();
  };
  lifeQueue = lifeQueue.then(run, run);
  return lifeQueue.catch(e => { toast(e.message || 'Could not save'); throw e; });
}

function vLife() {
  const L = S.life, open = L.tasks.filter(x => x.status === 'open'), done = L.tasks.filter(x => x.status === 'done').slice(-5);
  const pk = L.deliveries.filter(x => ['ordered', 'in_transit', 'ready_for_pickup', 'delivered'].includes(x.status)), fin = L.deliveries.filter(x => x.status === 'picked_up').slice(0, 3);
  const fact = factOfDay(shiftDate(todayIn(TZ), S.factOffset), {favorites: L.favorites});
  if (!S.caps.db) return offline('Private storage is unavailable. Open this page from claude.ai while signed in.');
  return `<section class="card col"><h2>To-dos</h2><div class="row"><input type="text" id="newtask" placeholder="Add a to-do" enterkeyhint="done" aria-label="New to-do"><button class="btn primary" data-act="addtask">Add</button></div>
    <div class="list">${open.map(t => taskRow(t)).join('') || '<p class="muted">Nothing open.</p>'}${done.map(t => taskRow(t)).join('')}</div></section>
  <section class="card col"><h2>Packages</h2>${pk.length ? `<div class="list">${pk.map(p => `<div class="item" style="flex-direction:column;gap:8px"><div class="row between"><div class="t">${esc(p.title)}</div><span class="pill ${p.status === 'ready_for_pickup' ? 'est' : ''}">${esc(p.status.replace(/_/g, ' '))}</span></div>
      <div class="faint small">${[p.carrier, p.trackingNumber ? 'Tracking ' + p.trackingNumber : '', p.expectedDelivery ? 'Expected ' + short(p.expectedDelivery) : ''].filter(Boolean).map(esc).join(' · ')}</div>
      ${p.pickupLocation ? `<div class="small">Pickup: ${esc(p.pickupLocation)}</div>` : ''}${p.pickupDeadline ? `<div class="small">Collect by <b>${esc(short(p.pickupDeadline))}</b></div>` : ''}${p.pickupCode ? `<div><span class="codebox">${esc(p.pickupCode)}</span></div>` : ''}
      <button class="btn sm" data-act="collected" data-id="${esc(p.id)}">Collected</button></div>`).join('')}</div>` : '<p class="muted">No outstanding packages. Scan your inbox to find them.</p>'}${fin.length ? `<div class="eyebrow">Collected</div>${fin.map(p => `<div class="faint small">✓ ${esc(p.title)}</div>`).join('')}` : ''}</section>
  ${factCard(fact)}<div class="row"><button class="btn quiet grow" data-act="factn" data-n="-1">Earlier fact</button><button class="btn quiet grow" data-act="factn" data-n="1" ${S.factOffset >= 0 ? 'disabled' : ''}>Later fact</button></div>`;
}
const taskRow = t => `<div class="item"><input type="checkbox" data-task="${esc(t.id)}" ${t.status === 'done' ? 'checked' : ''} aria-label="Complete ${esc(t.title)}"><div class="grow" style="${t.status === 'done' ? 'opacity:.5;text-decoration:line-through' : ''}"><div class="t">${esc(t.title)}</div>${t.dueDate ? `<div class="faint small">Due ${esc(short(t.dueDate))}</div>` : ''}${t.source === 'email' ? '<div class="faint small">From email</div>' : ''}</div><button class="btn sm quiet" data-act="deltask" data-id="${esc(t.id)}" aria-label="Delete">✕</button></div>`;

/* ---------- Settings ---------- */
function sheet() {
  const dirty = Object.keys(S.sync.dirty).sort();
  return `<div class="row between"><h2>Settings</h2><button class="btn sm quiet" data-act="closesheet">Close</button></div>
  <div class="col"><div class="eyebrow">Health records</div><p class="muted small">Stored privately in this app. Last GitHub sync: ${esc(S.sync.lastSyncedAt || 'not recorded')}.${dirty.length ? ` Changed since then: ${esc(dirty.map(short).join(', '))}.` : ' Nothing waiting.'} Ask Claude Code to “sync Cam’s Life to GitHub” to commit changes to <b>dist/data/health.json</b>.</p>
  ${S.data ? `<button class="btn" data-act="export" ${S.caps.downloads ? '' : 'disabled'}>Export health.json</button>` : ''}</div>
  <div class="col"><div class="eyebrow">Connections</div><p class="muted small">Claude: ${S.caps.sample ? 'available (uses your subscription)' : 'unavailable'} · Photos: ${S.caps.images ? 'supported' : 'not supported'} · Gmail connector: ${S.mail.state === 'ready' ? 'connected' : S.mail.state} · Storage: ${S.caps.db ? 'available' : 'unavailable'}</p></div>
  <p class="faint small">Photos are sent to Claude for one request and never stored. Body photos are never used to estimate body fat or muscle.</p>`;
}

/* ---------- events ---------- */
document.addEventListener('click', async ev => {
  const t = ev.target.closest('[data-act]'); if (!t) return;
  if (ev.target.closest('[data-stop]') && t.dataset.act === 'closesheet' && t.classList.contains('sheet-bg')) return;
  const a = t.dataset.act;
  if (a === 'tab') { S.tab = t.dataset.tab; S.stickBottom = S.tab === 'ask'; schedule(); if (S.tab === 'inbox' && S.mail.state === 'idle') mailCheck(); }
  else if (a === 'goask') { S.tab = 'ask'; S.stickBottom = true; schedule(); }
  else if (a === 'day') { S.date = shiftDate(S.date, Number(t.dataset.n)); schedule(); }
  else if (a === 'daytoday') { S.date = todayIn(TZ); schedule(); }
  else if (a === 'settings') { S.sheet = 'settings'; schedule(); }
  else if (a === 'closesheet') { S.sheet = null; schedule(); }
  else if (a === 'send') { const m = $('#msg'), v = m.value; m.value = ''; ask(v); }
  else if (a === 'stop') ctl?.abort();
  else if (a === 'prompt') { const m = $('#msg'); if (S.tab !== 'ask') { S.tab = 'ask'; schedule(); } ask(t.dataset.p); }
  else if (a === 'photo') $('#file')?.click();
  else if (a === 'rmphoto') { S.photo = null; schedule(); }
  else if (a === 'save') saveProposal(Number(t.dataset.i));
  else if (a === 'discard') { S.chat[Number(t.dataset.i)].discarded = true; schedule(); }
  else if (a === 'analyze') analyze();
  else if (a === 'mailcheck') mailCheck();
  else if (a === 'scan') scan();
  else if (a === 'findclean') findClean();
  else if (a === 'cleanup') cleanup(t.dataset.k);
  else if (a === 'addtask') { const i = $('#newtask'), title = i.value.trim(); if (title) { i.value = ''; mutateLife(s => upsertTask(s, {title}, nowISO())); } }
  else if (a === 'deltask') mutateLife(s => removeTask(s, t.dataset.id));
  else if (a === 'collected') mutateLife(s => ({...s, deliveries: markDeliveryPickedUp(s.deliveries, t.dataset.id)})).then(() => toast('Marked collected'));
  else if (a === 'fav') mutateLife(s => toggleFactFavorite(s, t.dataset.id));
  else if (a === 'factn') { S.factOffset = Math.min(0, S.factOffset + Number(t.dataset.n)); schedule(); }
  else if (a === 'export') { try { await downloads.save({filename: 'health.json', data: new Blob([JSON.stringify(S.data, null, 2) + '\n'], {type: 'application/json'})}); } catch { toast('Export was cancelled'); } }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'file' && t.files[0]) { S.photo = t.files[0]; schedule(); }
  else if (t.dataset.task) mutateLife(s => toggleTask(s, t.dataset.task, nowISO()));
  else if (t.dataset.sel != null) { S.mail.cleanup.matches[Number(t.dataset.sel)].sel = t.checked; S.mail.confirm = null; schedule(); }
});
document.addEventListener('input', ev => { if (ev.target.id === 'msg') autosize(ev.target); });
document.addEventListener('keydown', ev => {
  if (ev.target.id === 'msg' && ev.key === 'Enter' && !ev.shiftKey && matchMedia('(hover:hover)').matches) { ev.preventDefault(); const v = ev.target.value; ev.target.value = ''; ask(v); }
  if (ev.target.id === 'newtask' && ev.key === 'Enter') $('[data-act=addtask]').click();
  if (ev.key === 'Escape' && S.sheet) { S.sheet = null; schedule(); }
});

/* ---------- boot ---------- */
async function boot() {
  render();
  const claude = window.claude;
  if (!claude?.use) { schedule(); return; }
  [db, sample, mcp, downloads, userCap] = await Promise.all(['db', 'sample', 'mcp', 'downloads', 'user'].map(n => claude.use(n).catch(() => null)));
  S.caps = {db: !!db, sample: !!sample, mcp: !!mcp, downloads: !!downloads};
  if (sample?.limits) try { S.caps.images = !!(await sample.limits()).images; } catch { S.caps.images = false; }
  try { S.uid = userCap ? await userCap.id() : null; } catch { S.uid = null; }
  schedule();
  if (!db) { S.dataState = 'error'; S.errors.data = 'Private storage is unavailable.'; schedule(); return; }
  db.doc('health/meta').onSnapshot(s => { meta = s.exists ? s.data() : null; refreshData(); }, e => { S.dataState = 'error'; S.errors.data = e.message; schedule(); });
  db.collection('days').onSnapshot(s => { days = Object.fromEntries(s.docs.map(d => [d.id, d.data()])); refreshData(); }, e => { S.dataState = 'error'; S.errors.data = e.message; schedule(); });
  db.doc('health/sync').onSnapshot(s => { if (s.exists) S.sync = {dirty: s.data().dirty || {}, lastSyncedAt: s.data().lastSyncedAt || null}; schedule(); });
  if (S.uid) {
    lifeRef = db.collection('data/users/' + S.uid).doc('life');
    lifeRef.onSnapshot(s => { try { S.life = createLifeState(s.exists ? clone(s.data()) : {}); S.lifeState = 'ready'; } catch (e) { S.lifeState = 'error'; } schedule(); }, () => { S.lifeState = 'error'; schedule(); });
  }
}
boot();
