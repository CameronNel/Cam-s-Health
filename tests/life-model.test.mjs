import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stableId, createLifeState, validateLifeState, inspectLifeState, normalizeGmailMessage,
  classifyEmail, buildInboxDigest, buildCleanupPreview, parsePickup, parseEmailDueDate,
  extractDeliveries, mergeDeliveries, markDeliveryPickedUp, upsertTask, toggleTask,
  removeTask, FACTS, factOfDay, toggleFactFavorite,
} from '../dist/life-model.js';

const now = '2026-10-05T12:00:00Z';
const mail = (id, subject, body, extra = {}) => ({ id, subject, body, from: 'Shop <orders@example.com>', date: now, ...extra });
const encode = value => Buffer.from(value, 'utf8').toString('base64url');

test('default state preserves unknown fields and rejects future-version downgrades', () => {
  const state = createLifeState({ custom: { preserve: true } });
  assert.equal(validateLifeState(state), state);
  assert.deepEqual(state.custom, { preserve: true });
  assert.throws(() => createLifeState({ version: 2 }), /Unsupported/);
});

test('validation rejects malformed containers, duplicate IDs, invalid dates and missing titles', () => {
  assert.equal(inspectLifeState({ version: 1, tasks: {}, deliveries: [], favorites: [], lastDigest: null }).ok, false);
  const state = createLifeState({ tasks: [{ id: 'x', title: 'A', status: 'open' }, { id: 'x', title: 'B', status: 'open' }] });
  assert.throws(() => validateLifeState(state), /Duplicate/);
  assert.throws(() => validateLifeState(createLifeState({ tasks: [{ id: 'x', title: '', status: 'open', dueDate: '2026-02-31' }] })), /title.*dueDate/);
});

test('stable IDs are deterministic across object key order and differentiated by content', () => {
  assert.equal(stableId('x', { b: 2, a: 1 }), stableId('x', { a: 1, b: 2 }));
  assert.notEqual(stableId('x', { a: 1 }), stableId('x', { a: 2 }));
});

test('Gmail multipart chooses Unicode text and skips attachment bytes', () => {
  const message = normalizeGmailMessage({ id: 'gmail1', internalDate: '1791201600000', labelIds: ['UNREAD'], payload: {
    headers: [{ name: 'From', value: 'Café <support@example.com>' }, { name: 'Subject', value: 'Afhaalcode' }], mimeType: 'multipart/mixed', parts: [
      { mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/html', body: { data: encode('<b>wrong choice</b>') } }, { mimeType: 'text/plain', body: { data: encode('Je pakket ligt klaar. Café code: 482913') } }] },
      { filename: 'private.pdf', mimeType: 'text/plain', body: { data: encode('never import attachment content') } },
    ],
  } });
  assert.equal(message.fromName, 'Café');
  assert.equal(message.fromEmail, 'support@example.com');
  assert.match(message.body, /Café/);
  assert.doesNotMatch(message.body, /wrong choice|attachment content/);
  assert.equal(message.unread, true);
  assert.equal(message.hasAttachments, true);
});

test('HTML-only message drops script and decodes entities without a DOM', () => {
  const message = normalizeGmailMessage({ payload: { mimeType: 'text/html', body: { data: encode('<script>bad()</script><p>A &amp; B<br>Ready &#128230;</p>') } } });
  assert.match(message.body, /A & B\nReady 📦/);
  assert.doesNotMatch(message.body, /script|bad/);
  assert.equal(message.date, null);
});

test('raw Gmail RFC message supports folded headers and quoted-printable UTF8', () => {
  const raw = 'From: Shop <shop@example.com>\r\nSubject: Hello\r\n world\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nCaf=C3=A9: afhaalcode 123456';
  const email = normalizeGmailMessage({ id: 'raw1', raw: encode(raw) });
  assert.equal(email.subject, 'Hello world');
  assert.equal(email.body, 'Café: afhaalcode 123456');
});

test('raw multipart does not import attachment contents', () => {
  const raw = 'From: Shop <shop@example.com>\r\nContent-Type: multipart/mixed; boundary="xx"\r\n\r\n--xx\r\nContent-Type: text/plain\r\n\r\nYour parcel is ready for pickup.\r\n--xx\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename="private.txt"\r\n\r\nSECRET\r\n--xx--';
  const email = normalizeGmailMessage({ id: 'raw2', raw: encode(raw) });
  assert.match(email.body, /ready for pickup/);
  assert.doesNotMatch(email.body, /SECRET/);
});

test('automatic review cleanup requires supported sender domains', () => {
  assert.equal(classifyEmail(mail('1', 'Codex automatic review completed', '', { from: 'notifications@github.com' })).category, 'noise');
  assert.equal(classifyEmail(mail('2', 'Codex automatic review completed', '', { from: 'notifications@github.com.evil.example' })).category, 'updates');
  assert.equal(classifyEmail(mail('3', 'Codex automatic review completed', '', { from: 'person@example.com' })).category, 'updates');
});

test('explicit action overrides newsletter or automated noise classification', () => {
  const message = mail('1', 'Action required: please confirm payment', 'Newsletter unsubscribe', { headers: { 'List-Unsubscribe': '<https://example.com/unsub>' } });
  assert.equal(classifyEmail(message).category, 'action');
  assert.equal(buildCleanupPreview([message], 'delete useless mail').count, 0);
});

test('failed GitHub workflows are protected from cleanup', () => {
  const message = mail('1', 'GitHub Actions: workflow run failed', '', { from: 'notifications@github.com' });
  assert.equal(classifyEmail(message).category, 'action');
  assert.deepEqual(buildCleanupPreview([message], 'delete GitHub automated notifications').ids, []);
});

test('cleanup previews only supported requested noise and never directly mutates mail', () => {
  const messages = [
    mail('codex', 'Codex automatic approval review', '', { from: 'notifications@github.com', labels: ['UNREAD'] }),
    mail('news', 'Weekly newsletter', 'Unsubscribe'),
    mail('personal', 'Dinner tomorrow?', 'Please bring dessert'),
    mail('delivery', 'Parcel ready for pickup', 'Afhaalcode: 482913'),
  ];
  const before = JSON.stringify(messages);
  const preview = buildCleanupPreview(messages, 'delete unread Codex auto reviews');
  assert.deepEqual(preview.ids, ['codex']);
  assert.equal(preview.requiresReview, true);
  assert.equal(preview.destructive, false);
  assert.equal(JSON.stringify(messages), before);
  assert.deepEqual(new Set(buildCleanupPreview(messages, 'delete useless from mailbox').ids), new Set(['codex', 'news']));
});

test('unqualified delete everything yields no cleanup selection', () => {
  const messages = [mail('1', 'Weekly newsletter', 'Unsubscribe')];
  const preview = buildCleanupPreview(messages, 'delete everything');
  assert.equal(preview.count, 0);
  assert.match(preview.unsupportedReason, /supported/);
});

test('digest deduplicates message IDs and provides action tasks with explicit deadlines', () => {
  const message = mail('a', 'Action required', 'Please reply by October 8, 2026.');
  const digest = buildInboxDigest([message, message, mail('b', 'Update', 'FYI')], { generatedAt: now });
  assert.equal(digest.total, 2);
  assert.deepEqual(digest.counts, { action: 1, updates: 1, noise: 0 });
  assert.equal(digest.todos[0].dueDate, '2026-10-08');
  assert.equal(digest.todos[0].sourceEmailId, 'a');
  assert.equal(digest.generatedAt, now);
});

test('pickup parser preserves Dutch, Cipio and grouped PIN codes', () => {
  assert.equal(parsePickup('Je pakket ligt klaar.\nAfhaalcode: 482913').pickupCode, '482913');
  assert.equal(parsePickup('Cipio-code: 9AZ4P2').pickupCode, '9AZ4P2');
  assert.equal(parsePickup('Pincode: 482 913\nAfhaalpunt: Boekhandel Centrum').pickupCode, '482 913');
  assert.equal(parsePickup('Pickup code: AZRT').pickupCode, 'AZRT');
  assert.equal(parsePickup('Tracking number: 3S1234567890123').pickupCode, null);
});

test('pickup deadlines use explicit full dates and do not invent missing years', () => {
  const pickup = parsePickup('Afhaalcode: 482913\nAfhaalpunt: Boekhandel Centrum\nAfhalen uiterlijk 12 oktober 2026.');
  assert.equal(pickup.pickupDeadline, '2026-10-12');
  assert.equal(pickup.pickupLocation, 'Boekhandel Centrum');
  assert.equal(parsePickup('Collect by 12 October.').pickupDeadline, null);
  assert.equal(parsePickup('Collect by 05/10/2026.').pickupDeadline, null);
  assert.equal(parsePickup('Afhalen uiterlijk 05/10/2026.').pickupDeadline, '2026-10-05');
  assert.equal(parsePickup('Collect by 2026-02-31.').pickupDeadline, null);
  assert.equal(parsePickup('Expected delivery 2026-10-12.').pickupDeadline, null);
});

test('due-date parser ignores unrelated dates', () => {
  assert.equal(parseEmailDueDate(mail('1', 'Receipt', 'Ordered on 2026-10-01.')), null);
  assert.equal(parseEmailDueDate(mail('1', 'Payment due', 'Payment due 2026-10-09.')), '2026-10-09');
});

test('delivery extraction merges repeated tracking notifications and enriches pickup details', () => {
  const old = mail('s1', 'Your package shipped', 'Tracking number: 3S1234567890123\nOrder number: CAM12345', { date: '2026-10-04T09:00:00Z' });
  const newer = mail('s2', 'Your package is ready for pickup', 'PostNL\nTracking number: 3S1234567890123\nAfhaalcode: 482913\nAfhalen uiterlijk 2026-10-12.');
  const deliveries = extractDeliveries([newer, old]);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].status, 'ready_for_pickup');
  assert.equal(deliveries[0].pickupCode, '482913');
  assert.equal(deliveries[0].orderReference, 'CAM12345');
  assert.equal(deliveries[0].carrier, 'PostNL');
  assert.deepEqual(new Set(deliveries[0].sourceEmailIds), new Set(['s1', 's2']));
});

test('order-reference dedup is scoped to merchant and keeps separate tracked split parcels', () => {
  const sameShop = [mail('a', 'Order confirmation', 'Order number: 123456'), mail('b', 'Your package shipped', 'Order number: 123456')];
  assert.equal(extractDeliveries(sameShop).length, 1);
  assert.equal(extractDeliveries([...sameShop, mail('c', 'Order confirmation', 'Order number: 123456', { from: 'another@different-shop.com' })]).length, 2);
  assert.equal(extractDeliveries([mail('a', 'Your package shipped', 'Order number: 123456\nTracking: AA123456'), mail('b', 'Your package shipped', 'Order number: 123456\nTracking: BB123456')]).length, 2);
});

test('mail sync never reopens manually completed deliveries and preserves custom fields', () => {
  const original = extractDeliveries([mail('a', 'Your parcel is ready for pickup', 'Tracking number: 3S1234567890123\nAfhaalcode: 482913')]);
  original[0].customNotes = 'Keep this';
  const completed = markDeliveryPickedUp(original, original[0].id, now);
  const synced = extractDeliveries([mail('b', 'Your package shipped', 'Tracking number: 3S1234567890123', { date: '2026-10-06T09:00:00Z' })], completed);
  assert.equal(synced.length, 1);
  assert.equal(synced[0].status, 'picked_up');
  assert.equal(synced[0].completedAt, now);
  assert.equal(synced[0].customNotes, 'Keep this');
  assert.equal(original[0].status, 'ready_for_pickup');
});

test('delivery merge preserves null-unknown values and does not regress to old status', () => {
  const previous = [{ id: 'd', title: 'Package', status: 'ready_for_pickup', trackingNumber: 'AA123456', pickupCode: '1234', custom: true }];
  const result = mergeDeliveries(previous, [{ id: 'new', title: 'Older notice', status: 'in_transit', trackingNumber: 'AA123456', pickupCode: null }]);
  assert.equal(result[0].id, 'd');
  assert.equal(result[0].pickupCode, '1234');
  assert.equal(result[0].status, 'ready_for_pickup');
  assert.equal(result[0].custom, true);
});

test('a delivered-to-pickup-point email is not treated as a home delivery completion', () => {
  const deliveries = extractDeliveries([mail('a', 'Your parcel', 'Tracking: AA123456\nPackage delivered to the pickup point.')]);
  assert.equal(deliveries[0].status, 'ready_for_pickup');
});

test('no inferred parcel is created from incidental shop prose or unlabelled digits', () => {
  assert.equal(extractDeliveries([mail('1', 'Hello', 'Your restaurant table is 123456. We offer delivery.')]).length, 0);
});

test('task CRUD is immutable, preserves unknown state and supports arrays', () => {
  const original = createLifeState({ custom: 'retain' });
  const inserted = upsertTask(original, { id: 't1', title: 'Pick up parcel', customTag: 'Keep' }, now);
  assert.equal(original.tasks.length, 0);
  assert.equal(inserted.custom, 'retain');
  const done = toggleTask(inserted, 't1', now);
  assert.equal(done.tasks[0].status, 'done');
  assert.equal(done.tasks[0].completedAt, now);
  assert.equal(done.tasks[0].customTag, 'Keep');
  assert.equal(inserted.tasks[0].status, 'open');
  const reopened = toggleTask(done, 't1', now);
  assert.equal(reopened.tasks[0].completedAt, null);
  assert.equal(removeTask(reopened, 't1').tasks.length, 0);
  assert.equal(upsertTask([], { title: 'Call dentist' }, now)[0].status, 'open');
});

test('invalid task updates fail before returning a state', () => {
  assert.throws(() => upsertTask([], { title: ' ' }, now), /title/);
  assert.throws(() => upsertTask([], { title: 'A', status: 'invented' }, now), /status/);
  assert.throws(() => toggleTask([], 'missing', now), /not found/);
});

test('fact rotation is deterministic, source backed and checks dates', () => {
  assert.equal(FACTS.length, 20);
  assert.equal(new Set(FACTS.map(fact => fact.id)).size, FACTS.length);
  for (const fact of FACTS) { assert.match(fact.sourceURL, /^https:\/\//); assert.ok(fact.sourceTitle && fact.title && fact.body); }
  assert.deepEqual(factOfDay('2026-10-05'), factOfDay('2026-10-05'));
  assert.notEqual(factOfDay('2026-10-05').id, factOfDay('2026-10-06').id);
  assert.ok(factOfDay('2026-10-05').text && factOfDay('2026-10-05').source);
  assert.throws(() => factOfDay('2026-02-31'), /valid/);
});

test('favorite toggles preserve state and reject unknown facts', () => {
  const original = createLifeState({ custom: true });
  const saved = toggleFactFavorite(original, FACTS[0].id);
  assert.deepEqual(saved.favorites, [FACTS[0].id]);
  assert.deepEqual(original.favorites, []);
  assert.equal(saved.custom, true);
  assert.deepEqual(toggleFactFavorite(saved, FACTS[0].id).favorites, []);
  assert.throws(() => toggleFactFavorite([], 'made-up'), /Unknown/);
});
