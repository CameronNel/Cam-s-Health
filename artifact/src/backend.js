// Runtime bridge for the copied Cam's Life UI: Artifact storage, Claude (sample) and the Gmail connector.
import {createLifeState, validateLifeState} from '../../dist/life-model.js';
import {discover, createGateway, gmailTools, scanPrompt, cleanupPrompt} from './gmail.js';

const clone = v => structuredClone(v);
const listeners = new Set();
export const backend = {
  db: null, sample: null, mcp: null, downloads: null, uid: null, images: false, lifeRef: null,
  meta: null, days: {}, sync: {dirty: {}, lastSyncedAt: null}, snapshotsReady: {meta: false, days: false}, error: '',
  gmail: {state: 'unknown', tools: {}},
  onData(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit() { listeners.forEach(fn => { try { fn(); } catch { /* a listener must not break storage */ } }); }
};

backend.ready = (async () => {
  const claude = window.claude;
  if (!claude?.use) { backend.error = 'Open this app inside claude.ai to use your private storage and Claude.'; return; }
  const get = name => claude.use(name).catch(() => null);
  [backend.db, backend.sample, backend.mcp, backend.downloads] = await Promise.all([get('db'), get('sample'), get('mcp'), get('downloads')]);
  const user = await get('user');
  if (backend.sample?.limits) { try { backend.images = !!(await backend.sample.limits()).images; } catch { backend.images = false; } }
  try { backend.uid = user ? await user.id() : null; } catch { backend.uid = null; }
  if (!backend.db) { backend.error = 'Private storage is unavailable in this view.'; return; }
  const fail = e => { backend.error = e?.message || 'Storage error'; backend.emit(); };
  backend.db.doc('health/meta').onSnapshot(s => { backend.meta = s.exists ? clone(s.data()) : null; backend.snapshotsReady.meta = true; backend.emit(); }, fail);
  backend.db.collection('days').onSnapshot(s => { backend.days = Object.fromEntries(s.docs.map(d => [d.id, clone(d.data())])); backend.snapshotsReady.days = true; backend.emit(); }, fail);
  backend.db.doc('health/sync').onSnapshot(s => { if (s.exists) backend.sync = {dirty: s.data().dirty || {}, lastSyncedAt: s.data().lastSyncedAt || null}; backend.emit(); }, () => {});
  if (backend.uid) backend.lifeRef = backend.db.collection('data/users/' + backend.uid).doc('life');
})();

export function assemble(meta, days) {
  if (!meta) return null;
  const data = {schemaVersion: 1, updatedAt: meta.updatedAt, profile: meta.profile, training: meta.training, days: clone(days)};
  if (meta.recipes) data.recipes = meta.recipes;
  if (meta.provenance) data.provenance = meta.provenance;
  return data;
}

const friendly = e => ({
  not_granted: 'Claude access was declined for this view. Reload and allow it to continue.',
  rate_limited: 'Claude is rate-limited right now. Try again in a little while.',
  invalid_json: 'Claude’s answer could not be read. Try rephrasing, or send fewer items at once.',
  session_expired: 'Your claude.ai session expired. Sign in again.',
  refused: 'Claude declined that input.',
  images_unavailable: 'Photos are not supported in this view.',
  image_rejected: 'That photo could not be used. Try a JPEG or PNG under 20 MB.',
  prompt_too_large: 'That was too much to send at once.',
  sampling_disabled: 'Claude is not available for this account.'
}[e?.code] || e?.message || `Claude could not finish (${e?.code || 'error'}). Nothing was changed.`);

/** Ask Claude for JSON. Rejects with a plain Error whose message is safe to show. */
backend.askJson = async (input, options = {}) => {
  await backend.ready;
  if (!backend.sample) throw Error('Claude is not available in this view. Open the app inside claude.ai.');
  try { return await backend.sample.json(input, options); }
  catch (e) { if (e?.code === 'cancelled') throw Object.assign(Error('Stopped.'), {cancelled: true}); throw Error(friendly(e)); }
};

/* ---------- private life state (to-dos, packages, favourites, scanned mail) ---------- */
backend.life = {
  async get() {
    await backend.ready;
    if (!backend.lifeRef) throw Error('Private storage is unavailable in this view.');
    const snap = await backend.lifeRef.get(), doc = snap.exists ? snap.data() : {};
    return {state: createLifeState(doc.state ? clone(doc.state) : {}), version: doc.version || 0};
  },
  async put(state, version) {
    await backend.ready;
    const snap = await backend.lifeRef.get(), current = snap.exists ? snap.data().version || 0 : 0;
    if (current !== version) throw Error('Your records changed elsewhere. The latest version was loaded; nothing was overwritten.');
    validateLifeState(state);
    await backend.lifeRef.set({state, version: current + 1});
    return {state, version: current + 1};
  }
};

/* ---------- Gmail via the viewer's claude.ai connector ---------- */
backend.checkGmail = async () => {
  await backend.ready;
  backend.gmail = await discover(backend.mcp);
  if (backend.gmail.state === 'ready' && !(backend.gmail.tools.search && backend.gmail.tools.read)) backend.gmail = {state: 'missing_tools', tools: backend.gmail.tools};
  return backend.gmail;
};
const needGmail = async () => { const g = await backend.checkGmail(); if (g.state !== 'ready') throw Error(g.state === 'server_not_connected' ? 'Gmail is not connected. In claude.ai open Settings → Connectors, add Gmail, then reload this app.' : g.state === 'needs_reauth' ? 'Reconnect Gmail in claude.ai Settings → Connectors.' : `Gmail is not ready (${g.state}).`); return g; };
const todayAms = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Amsterdam'}).format(new Date());

backend.scanInbox = async ({days = 7, onProgress} = {}) => {
  const g = await needGmail(), seen = new Map(), gw = createGateway(backend.mcp, g.tools, seen);
  const out = await backend.askJson(scanPrompt(todayAms(), days), {tools: gmailTools(gw, onProgress), modelTier: 'default'});
  const corpus = [...seen.values()].join('\n'), problems = [];
  const verify = v => { if (v == null || v === '') return null; v = String(v).trim(); if (corpus.includes(v)) return v; problems.push(v); return null; };
  const dateOk = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null;
  const messages = (Array.isArray(out.messages) ? out.messages : []).filter(m => m?.id).map(m => ({id: String(m.id), subject: String(m.subject || ''), from: String(m.from || ''), snippet: String(m.summary || ''), date: m.date || null, unread: m.unread === true, category: m.category === 'action' ? 'action' : m.category === 'noise' ? 'noise' : 'updates'}));
  const deliveries = (Array.isArray(out.deliveries) ? out.deliveries : []).filter(d => d?.title).map(d => ({title: String(d.title).slice(0, 200), carrier: d.carrier || null, trackingNumber: verify(d.trackingNumber), pickupCode: verify(d.pickupCode), pickupLocation: d.pickupLocation || null, pickupDeadline: dateOk(d.pickupDeadline), expectedDelivery: dateOk(d.expectedDelivery), status: ['ordered', 'in_transit', 'ready_for_pickup', 'delivered', 'picked_up', 'cancelled', 'unknown'].includes(d.status) ? d.status : 'unknown', sourceEmailId: d.sourceEmailId ? String(d.sourceEmailId) : null}));
  const tasks = (Array.isArray(out.tasks) ? out.tasks : []).filter(t => t?.title).map(t => ({title: String(t.title).slice(0, 300), dueDate: dateOk(t.dueDate), sourceEmailId: String(t.sourceEmailId || t.title)}));
  return {summary: String(out.summary || ''), messages, deliveries, tasks, problems};
};

backend.findCleanup = async (request, {onProgress} = {}) => {
  const g = await needGmail(), gw = createGateway(backend.mcp, g.tools, new Map());
  const out = await backend.askJson(cleanupPrompt(request, todayAms()), {tools: gmailTools(gw, onProgress), modelTier: 'default'});
  return {summary: String(out.summary || ''), matches: (Array.isArray(out.matches) ? out.matches : []).filter(m => m?.id).slice(0, 40).map(m => ({id: String(m.id), subject: String(m.subject || ''), from: String(m.from || ''), reason: String(m.reason || ''), unread: m.unread === true}))};
};

backend.applyCleanup = async (ids, operation) => {
  const g = await needGmail(), gw = createGateway(backend.mcp, g.tools, new Map());
  const done = [], failed = [];
  for (const id of ids) { try { await gw.modify(id, operation); done.push(id); } catch (e) { failed.push({id, message: e.message}); } }
  return {done, failed};
};
