// Drop-in replacement for the old GitHubStore, backed by this Artifact's private database.
// GitHub stays the canonical copy: scripts/sync-health.mjs merges both ways (see docs/ARTIFACT.md).
import {validateLifeHealth} from '../../dist/health-intelligence.js';
import {backend, assemble} from './backend.js';

const clone = v => structuredClone(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export class ArtifactStore {
  constructor({onchange = () => {}} = {}) {
    this.onchange = onchange; this.data = null; this.busy = false; this.reading = false;
    this.status = 'Connecting'; this.error = ''; this.checkedAt = null; this.sha = null;
    this.account = 'Cam’s Life storage'; this.lastCommit = null;
    backend.onData(() => this.refresh());
  }
  get connected() { return true; }
  notify() { this.onchange(this); }
  get unsynced() { return Object.keys(backend.sync.dirty || {}).sort(); }
  refresh() {
    const ready = backend.snapshotsReady.meta && backend.snapshotsReady.days;
    if (!ready) { if (backend.error) { this.status = 'Connection unavailable'; this.error = backend.error; this.notify(); } return; }
    const data = assemble(backend.meta, backend.days);
    if (!data) { this.data = null; this.status = 'No records yet'; this.error = 'No health records have been imported into this app yet. Ask Claude Code to sync Cam’s Life from GitHub.'; this.notify(); return; }
    try {
      this.data = validateLifeHealth(data);
      const pending = this.unsynced.length;
      this.status = pending ? `${pending} day${pending === 1 ? '' : 's'} waiting for the hourly GitHub sync` : 'Matches the last GitHub sync';
      this.error = ''; this.checkedAt = new Date().toISOString();
    } catch (e) { this.status = 'Stored record failed validation'; this.error = e.message; }
    this.notify();
  }
  async load() { await backend.ready; this.refresh(); return this.data; }
  async connect() {}
  disconnect() {}
  async save(mutate) {
    await backend.ready;
    const db = backend.db;
    if (!db) throw Error('Storage is unavailable. Open this app inside claude.ai while signed in. Nothing was saved.');
    if (this.busy || this.reading) throw Error('A save is already in progress. Try again in a moment.');
    this.busy = true; this.status = 'Saving'; this.notify();
    try {
      // Re-read straight from storage so a stale screen can never overwrite a newer record.
      const [metaSnap, daysSnap] = await Promise.all([db.doc('health/meta').get(), db.collection('days').get()]);
      const freshMeta = metaSnap.exists ? clone(metaSnap.data()) : null;
      const freshDays = Object.fromEntries(daysSnap.docs.map(d => [d.id, clone(d.data())]));
      const base = assemble(freshMeta, freshDays);
      if (!base) throw Error('No health records are stored yet, so nothing can be changed.');
      validateLifeHealth(base);
      const data = clone(base);
      mutate(data);
      data.updatedAt = new Date().toISOString();
      validateLifeHealth(data);
      const changed = Object.keys(data.days).filter(d => !same(data.days[d], base.days[d]));
      const removed = Object.keys(base.days).filter(d => !(d in data.days));
      const metaChanged = ['profile', 'training', 'recipes', 'provenance'].some(k => !same(data[k], base[k]));
      for (const d of changed) await db.doc(`days/${d}`).set(data.days[d]);
      for (const d of removed) await db.doc(`days/${d}`).delete();
      if (changed.length || removed.length || metaChanged) {
        const {days, ...meta} = data;
        await db.doc('health/meta').set(meta);
        const mark = Object.fromEntries([...changed, ...removed].map(d => [d, data.updatedAt]));
        if (Object.keys(mark).length) { try { await db.doc('health/sync').update({dirty: mark}); } catch { await db.doc('health/sync').set({dirty: mark, lastSyncedAt: null}); } }
      }
      for (const d of changed) { const back = await db.doc(`days/${d}`).get(); if (!back.exists || !same(back.data(), data.days[d])) throw Error('Read-back did not match the submitted record. Refresh before trying again.'); }
      this.status = 'Saved and verified'; this.error = '';
      return data;
    } catch (e) { this.error = e.message; this.status = 'Not saved'; throw e; }
    finally { this.busy = false; this.notify(); }
  }
}
