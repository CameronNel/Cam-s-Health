import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeHealth} from '../scripts/sync-health.mjs';

const food = (id, kcal = 100) => ({id, name: id, quantity: '1', kcal, protein: 1, carbs: 1, fat: 1, estimated: false, source: 's', note: ''});
const day = values => ({food: [], workouts: [], steps: null, waterMl: null, weightKg: null, notes: '', ...values});
const base = () => ({schemaVersion: 1, updatedAt: '2026-10-05T10:00:00.000Z', profile: {name: 'Cam', timezone: 'Europe/Amsterdam', targets: {kcal: 1900, protein: 150, carbs: 210, fat: 50, steps: 10000}, trainingStatus: 'ready'},
  training: {rotation: ['a'], sessions: [{id: 'a', name: 'A', exercises: []}]}, days: {'2026-10-04': day({food: [food('old')]}), '2026-10-05': day({food: [food('x')]})}});
const copy = v => structuredClone(v);

test('nothing changed: merge is a no-op in both directions', () => {
  const b = base(), {merged, report} = mergeHealth(b, copy(b), copy(b));
  assert.deepEqual(merged, b);
  assert.equal(report.githubChanged, false);
  assert.equal(report.appChanged, false);
  assert.deepEqual(report.conflicts, []);
});

test('app-only change goes to GitHub, and every existing entry is kept', () => {
  const b = base(), a = copy(b); a.days['2026-10-05'].food.push(food('app-meal', 300)); a.updatedAt = '2026-10-05T11:00:00.000Z';
  const {merged, report} = mergeHealth(b, copy(b), a);
  assert.deepEqual(merged.days['2026-10-05'].food.map(f => f.id), ['x', 'app-meal']);
  assert.deepEqual(merged.days['2026-10-04'], b.days['2026-10-04']);
  assert.equal(report.githubChanged, true);
  assert.equal(report.appChanged, false);
});

test('GitHub-only change (chat logging) flows into the app', () => {
  const b = base(), g = copy(b); g.days['2026-10-05'].food.push(food('chat-meal')); g.days['2026-10-05'].steps = 8000; g.updatedAt = '2026-10-05T11:00:00.000Z';
  const {merged, report} = mergeHealth(b, g, copy(b));
  assert.equal(merged.days['2026-10-05'].steps, 8000);
  assert.equal(report.githubChanged, false);
  assert.equal(report.appChanged, true);
  assert.deepEqual(report.fromGithub, ['2026-10-05']);
});

test('both sides add different meals the same day: both survive', () => {
  const b = base(), g = copy(b), a = copy(b);
  g.days['2026-10-05'].food.push(food('chat-meal')); a.days['2026-10-05'].food.push(food('app-meal')); a.days['2026-10-05'].waterMl = 500;
  const {merged, report} = mergeHealth(b, g, a);
  assert.deepEqual(merged.days['2026-10-05'].food.map(f => f.id).sort(), ['app-meal', 'chat-meal', 'x']);
  assert.equal(merged.days['2026-10-05'].waterMl, 500);
  assert.deepEqual(report.conflicts, []);
  assert.equal(report.githubChanged && report.appChanged, true);
});

test('the same entry edited in both places keeps GitHub and reports the conflict', () => {
  const b = base(), g = copy(b), a = copy(b);
  g.days['2026-10-05'].food[0].kcal = 111; a.days['2026-10-05'].food[0].kcal = 222;
  const {merged, report} = mergeHealth(b, g, a);
  assert.equal(merged.days['2026-10-05'].food[0].kcal, 111);
  assert.equal(report.conflicts.length, 1);
  assert.match(report.conflicts[0], /2026-10-05\/food\/x/);
});

test('an edit on one side beats an untouched copy on the other', () => {
  const b = base(), a = copy(b); a.days['2026-10-05'].food[0].kcal = 222;
  assert.equal(mergeHealth(b, copy(b), a).merged.days['2026-10-05'].food[0].kcal, 222);
  const g = copy(b); g.days['2026-10-05'].food[0].kcal = 333;
  assert.equal(mergeHealth(b, g, copy(b)).merged.days['2026-10-05'].food[0].kcal, 333);
});

test('a deletion applies only when the other side did not edit that entry', () => {
  const b = base(), a = copy(b); a.days['2026-10-05'].food = [];
  assert.deepEqual(mergeHealth(b, copy(b), a).merged.days['2026-10-05'].food, []);
  const g = copy(b); g.days['2026-10-05'].food[0].kcal = 999;
  const {merged, report} = mergeHealth(b, g, a);
  assert.equal(merged.days['2026-10-05'].food[0].kcal, 999);
  assert.equal(report.conflicts.length, 1);
});

test('merging twice is stable and an invalid result is rejected', () => {
  const b = base(), a = copy(b); a.days['2026-10-05'].food.push(food('app-meal'));
  const once = mergeHealth(b, copy(b), a).merged, twice = mergeHealth(once, copy(once), copy(once));
  assert.deepEqual(twice.merged, once);
  const dup = copy(b); dup.days['2026-10-05'].food.push({...food('x'), name: 'dup'});
  assert.throws(() => mergeHealth(b, dup, copy(b)), /duplicate|Invalid/i);
});
