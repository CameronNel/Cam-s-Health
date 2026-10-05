import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {createWorker} from '../server/worker.mjs';
import {createLifeState, stableId} from '../dist/life-model.js';

const SITE = 'https://cams-life.example';
const OWNER = 'site-user-cam';
const OTHER = 'site-user-other';
const NOW = new Date('2026-10-05T13:00:00.000Z');
const SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

function sqliteD1() {
  const db = new DatabaseSync(':memory:');
  const directory = new URL('../drizzle/', import.meta.url);
  for (const file of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(file, directory), 'utf8'));
  let failAudit = false;
  return {
    raw: db,
    failAudit(value = true) {failAudit = value;},
    prepare(sql) {
      let parameters = [];
      const query = {
        bind(...values) {parameters = values; return query;},
        async first() {return db.prepare(sql).get(...parameters) || null;},
        async all() {return {results: db.prepare(sql).all(...parameters)};},
        async run() {
          if (failAudit && sql.startsWith('INSERT INTO mailbox_audit')) throw Error('Audit unavailable');
          const result = db.prepare(sql).run(...parameters);
          return {meta: {changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid)}};
        },
      };
      return query;
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {const results = []; for (const statement of statements) results.push(await statement.run()); db.exec('COMMIT'); return results;}
      catch (error) {db.exec('ROLLBACK'); throw error;}
    },
  };
}

function fixture({messages = [], db = sqliteD1(), email = 'cam@example.com'} = {}) {
  const calls = []; let currentEmail = email;
  const fetcher = async (input, options = {}) => {
    const url = new URL(String(input));
    calls.push({url: url.href, method: options.method || 'GET', body: options.body});
    if (url.href === 'https://oauth2.googleapis.com/token') {
      const parameters = new URLSearchParams(options.body);
      if (parameters.get('grant_type') === 'authorization_code') return Response.json({access_token: 'access-cam', refresh_token: `refresh-cam-${currentEmail}`, scope: SCOPE});
      assert.match(parameters.get('refresh_token'), /^refresh-cam-/);
      return Response.json({access_token: 'access-cam', scope: SCOPE});
    }
    if (url.href === 'https://oauth2.googleapis.com/revoke') return new Response('', {status: 200});
    assert.equal(url.origin, 'https://gmail.googleapis.com');
    assert.equal(options.headers.authorization, 'Bearer access-cam');
    const path = url.pathname.replace('/gmail/v1/users/me/', '');
    if (path === 'profile') return Response.json({emailAddress: currentEmail});
    if (path === 'messages') return Response.json({messages: messages.map(message => ({id: message.id})), nextPageToken: messages.length > 40 ? 'more' : undefined});
    if (path === 'messages/batchModify') return new Response(null, {status: 204});
    if (path.startsWith('messages/')) {
      const id = path.split('/')[1];
      const message = messages.find(item => item.id === id);
      if (!message) return Response.json({error: 'Not found'}, {status: 404});
      return Response.json(message);
    }
    throw Error(`Unexpected fake upstream path ${path}`);
  };
  const worker = createWorker({fetcher, crypto: webcrypto, now: () => new Date(NOW)});
  const env = {LIFE_DB: db, GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'client-secret', LIFE_ENCRYPTION_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64')};
  const request = (path, {method = 'GET', owner = OWNER, origin = SITE, body, headers = {}} = {}) => {
    const allHeaders = {...headers};
    if (owner) allHeaders['oai-authenticated-user-id'] = owner;
    if (origin !== null && method !== 'GET') allHeaders.origin = origin;
    if (body !== undefined) allHeaders['content-type'] = 'application/json';
    return worker.fetch(new Request(`${SITE}${path}`, {method, headers: allHeaders, body: body === undefined ? undefined : JSON.stringify(body)}), env);
  };
  const connect = async (owner = OWNER) => {
    const response = await request('/api/inbox/connect', {method: 'POST', owner}); assert.equal(response.status, 200);
    const authorization = new URL((await response.json()).url);
    assert.equal(authorization.origin, 'https://accounts.google.com');
    assert.equal(authorization.searchParams.get('redirect_uri'), `${SITE}/api/inbox/callback`);
    assert.equal(authorization.searchParams.get('scope'), SCOPE);
    const callback = await request(`/api/inbox/callback?state=${authorization.searchParams.get('state')}&code=authorization-code`, {owner});
    assert.equal(callback.status, 303);
    return authorization.searchParams.get('state');
  };
  return {db, worker, env, calls, request, connect, setEmail(value) {currentEmail = value;}};
}

function mail(id, subject, body = '', from = 'Shop <shop@example.com>') {
  return {id, threadId: `thread-${id}`, internalDate: String(NOW.getTime()), labelIds: ['INBOX', 'UNREAD'], snippet: body, payload: {mimeType: 'text/plain', headers: [{name: 'Subject', value: subject}, {name: 'From', value: from}], body: {data: Buffer.from(body).toString('base64url')}}};
}

test('API identity is required and configured owner restriction is enforced', async () => {
  const app = fixture();
  assert.equal((await app.request('/api/status', {owner: null})).status, 401);
  app.env.LIFE_OWNER_ID = OWNER;
  assert.equal((await app.request('/api/life', {owner: OTHER})).status, 403);
});

test('state mutations reject missing and foreign origins without creating data', async () => {
  const app = fixture();
  for (const origin of [null, 'https://attacker.example']) {
    const result = await app.request('/api/life', {method: 'PUT', origin, body: {state: createLifeState(), version: 0}});
    assert.equal(result.status, 403);
  }
  assert.equal(app.db.raw.prepare('SELECT count(*) AS count FROM life_state').get().count, 0);
});

test('status reports subscription handoff and scheduler stays disabled by default', async () => {
  const app = fixture();
  const status = await (await app.request('/api/status')).json();
  assert.equal(status.aiMode, 'subscription-handoff');
  assert.equal(status.aiConfigured, false); assert.equal(status.hourlySync, false);
  assert.equal((await app.request('/api/assistant', {method: 'POST', body: {message: 'Hi'}})).status, 404);
  assert.equal(app.calls.length, 0);
});

test('life CAS preserves concurrent changes and owner isolation', async () => {
  const app = fixture(); const state = createLifeState({custom: 'preserved'});
  assert.equal((await app.request('/api/life', {method: 'PUT', body: {state, version: 0}})).status, 200);
  assert.equal((await app.request('/api/life', {method: 'PUT', body: {state: {...state, custom: 'overwrite'}, version: 0}})).status, 409);
  const saved = await (await app.request('/api/life')).json();
  assert.equal(saved.state.custom, 'preserved'); assert.equal(saved.version, 1);
  const other = await (await app.request('/api/life', {owner: OTHER})).json(); assert.equal(other.version, 0);
  const updated = await (await app.request('/api/life', {method: 'PUT', body: {state: {...state, custom: 'corrected'}, version: 1}})).json();
  assert.equal(updated.version, 2);
});

test('invalid life state is rejected before any persistence', async () => {
  const app = fixture();
  assert.equal((await app.request('/api/life', {method: 'PUT', body: {state: createLifeState({tasks: [{id: 'bad'}]}), version: 0}})).status, 400);
  assert.equal(app.db.raw.prepare('SELECT count(*) AS count FROM life_state').get().count, 0);
});

test('Gmail OAuth state is owner-bound, expiring, single-use, and refresh tokens are encrypted', async () => {
  const app = fixture();
  const start = await (await app.request('/api/inbox/connect', {method: 'POST'})).json();
  const state = new URL(start.url).searchParams.get('state');
  assert.equal((await app.request(`/api/inbox/callback?state=${state}&code=code`, {owner: OTHER})).status, 400);
  assert.equal(app.calls.length, 0);
  assert.equal((await app.request(`/api/inbox/callback?state=${state}&code=code`)).status, 303);
  const account = app.db.raw.prepare('SELECT * FROM mailbox_accounts WHERE owner_id = ?').get(OWNER);
  assert.match(account.encrypted_refresh_token, /^v1\./); assert.ok(!account.encrypted_refresh_token.includes('refresh-cam'));
  assert.equal(account.email, 'cam@example.com');
  assert.equal((await app.request(`/api/inbox/callback?state=${state}&code=code`)).status, 400);
});

test('Gmail OAuth will not start with an invalid encryption key', async () => {
  const app = fixture(); app.env.LIFE_ENCRYPTION_KEY = 'bad-key';
  assert.equal((await app.request('/api/inbox/connect', {method: 'POST'})).status, 503);
  assert.equal(app.calls.length, 0);
});

const setupClient = {clientId:'123456789-cams-life.apps.googleusercontent.com',clientSecret:'GOCSPX-synthetic-client-fixture',redirectUris:[SITE+'/api/inbox/callback']};
function withoutGoogleEnv(app) {delete app.env.GOOGLE_CLIENT_ID;delete app.env.GOOGLE_CLIENT_SECRET;return app;}

test('missing Google client is an actionable setup state, independent of ready encryption', async () => {
  const app = withoutGoogleEnv(fixture());
  const status = await (await app.request('/api/status')).json();
  assert.equal(status.gmail,false);assert.deepEqual(status.gmailSetup,{configured:false,source:null,storageReady:true,encryptionReady:true,redirectUri:SITE+'/api/inbox/callback'});
  const response = await app.request('/api/inbox/connect',{method:'POST'});
  assert.equal(response.status,503);assert.match((await response.json()).error,/Settings/);assert.equal(app.calls.length,0);
});

test('Settings client is encrypted, isolated by owner, never exposed, and works for OAuth and refresh', async () => {
  const app = withoutGoogleEnv(fixture());
  const life = createLifeState({tasks:[{id:'keep-task',title:'Keep this task',status:'open'}]});
  await app.request('/api/life',{method:'PUT',body:{state:life,version:0}});
  const saved = await app.request('/api/inbox/setup',{method:'POST',body:setupClient});
  assert.equal(saved.status,200);assert.ok(!(await saved.text()).includes(setupClient.clientSecret));
  const row = app.db.raw.prepare('SELECT * FROM mailbox_oauth_clients WHERE owner_id = ?').get(OWNER);
  assert.match(row.encrypted_client,/^v1\./);assert.ok(!row.encrypted_client.includes(setupClient.clientSecret));assert.ok(!row.encrypted_client.includes(setupClient.clientId));
  const statusResponse = await app.request('/api/status');assert.equal(statusResponse.headers.get('cache-control'),'no-store');const rawStatus=await statusResponse.text();
  assert.ok(!rawStatus.includes(setupClient.clientSecret));assert.ok(!rawStatus.includes(setupClient.clientId));assert.equal(JSON.parse(rawStatus).gmailSetup.source,'settings');
  assert.equal((await (await app.request('/api/status',{owner:OTHER})).json()).gmail,false);
  assert.equal((await app.request('/api/inbox/connect',{method:'POST',owner:OTHER})).status,503);
  await app.connect();await app.request('/api/inbox/sync',{method:'POST',body:{}});
  const tokenCalls=app.calls.filter(call=>call.url==='https://oauth2.googleapis.com/token');assert.equal(tokenCalls.length,2);
  for(const call of tokenCalls){const params=new URLSearchParams(call.body);assert.equal(params.get('client_id'),setupClient.clientId);assert.equal(params.get('client_secret'),setupClient.clientSecret);}
  const current=await (await app.request('/api/life')).json();assert.deepEqual(current.state.tasks,life.tasks);
});

test('Google setup validates the Web client and exact redirect, and rejects foreign writes', async () => {
  const app=withoutGoogleEnv(fixture());
  for(const body of [{...setupClient,clientId:'desktop-client'},{...setupClient,clientSecret:''},{...setupClient,redirectUris:['https://attacker.example/api/inbox/callback']}])assert.equal((await app.request('/api/inbox/setup',{method:'POST',body})).status,400);
  for(const origin of [null,'https://attacker.example'])assert.equal((await app.request('/api/inbox/setup',{method:'POST',body:setupClient,origin})).status,403);
  assert.equal((await app.request('/api/inbox/setup',{method:'POST',body:setupClient,owner:null})).status,401);
  assert.equal(app.db.raw.prepare('SELECT count(*) AS count FROM mailbox_oauth_clients').get().count,0);assert.equal(app.calls.length,0);
  app.env.LIFE_ENCRYPTION_KEY='invalid';assert.equal((await app.request('/api/inbox/setup',{method:'POST',body:setupClient})).status,503);
});

test('changing Google setup invalidates pending consent and never replaces a connected client', async () => {
  const app=withoutGoogleEnv(fixture());await app.request('/api/inbox/setup',{method:'POST',body:setupClient});
  const start=await (await app.request('/api/inbox/connect',{method:'POST'})).json(),nonce=new URL(start.url).searchParams.get('state');
  const second={...setupClient,clientSecret:'GOCSPX-second-synthetic-fixture'};
  assert.equal((await app.request('/api/inbox/setup',{method:'POST',body:second})).status,200);
  assert.equal((await app.request('/api/inbox/callback?state='+nonce+'&code=old-code')).status,400);assert.equal(app.calls.length,0);
  await app.connect();const before=app.db.raw.prepare('SELECT * FROM mailbox_oauth_clients').get();
  assert.equal((await app.request('/api/inbox/setup',{method:'POST',body:setupClient})).status,409);
  assert.deepEqual(app.db.raw.prepare('SELECT * FROM mailbox_oauth_clients').get(),before);
  assert.equal((await (await app.request('/api/status')).json()).gmailConnected,true);
});

test('Google settings cannot replace a server-managed client', async () => {
  const app=fixture();assert.equal((await app.request('/api/inbox/setup',{method:'POST',body:setupClient})).status,409);
  assert.equal(app.db.raw.prepare('SELECT count(*) AS count FROM mailbox_oauth_clients').get().count,0);
});

test('Gmail sync builds digest, deliveries and todos without reopening finished tasks', async () => {
  const messages = [mail('action1', 'Invoice due: please confirm', 'Please reply by 2026-10-10.'), mail('package1', 'Package ready for pickup', 'Your package is ready for pickup. Tracking: 3SABC123456789. Pickup code: 774411.'), mail('noise1', 'Codex automatic approval review', 'Codex automatic approval review completed', 'GitHub <notifications@github.com>')];
  const app = fixture({messages}); await app.connect();
  const state = createLifeState({tasks: [{id: stableId('task-mail', 'action1'), title: 'Already dealt with', status: 'done'}]});
  await app.request('/api/life', {method: 'PUT', body: {state, version: 0}});
  const response = await app.request('/api/inbox/sync', {method: 'POST', body: {}});
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.state.emails.length, 3); assert.equal(saved.state.lastDigest.noise.length, 1);
  assert.equal(saved.state.tasks.find(task => task.id === stableId('task-mail', 'action1')).status, 'done');
  assert.equal(saved.state.deliveries[0].pickupCode, '774411'); assert.equal(saved.state.deliveries[0].status, 'ready_for_pickup');
  assert.equal(saved.version, 2);
});

test('sync hard caps message fetches at 40 and reports limited results', async () => {
  const messages = Array.from({length: 45}, (_, index) => mail(`message${index}`, `Message ${index}`));
  const app = fixture({messages}); await app.connect();
  const result = await (await app.request('/api/inbox/sync', {method: 'POST', body: {}})).json();
  assert.equal(result.messages, 40); assert.equal(result.limited, true);
  assert.equal(app.calls.filter(call => /\/messages\/message/.test(call.url)).length, 40);
});

test('cleanup only changes mailbox after a reviewed single-use owner-bound preview', async () => {
  const app = fixture({messages: [mail('noise1', 'Codex automatic review')]}); await app.connect();
  assert.equal((await app.request('/api/inbox/cleanup', {method: 'POST', body: {stage: 'apply', previewToken: 'invalid'}})).status, 400);
  assert.equal((await app.request('/api/inbox/cleanup', {method: 'POST', body: {stage: 'preview', messageIds: ['noise1'], operation: 'delete'}})).status, 400);
  const preview = await (await app.request('/api/inbox/cleanup', {method: 'POST', body: {stage: 'preview', messageIds: ['noise1'], operation: 'archive'}})).json();
  assert.equal(preview.messages[0].subject, 'Codex automatic review'); assert.equal(preview.requiresConfirmation, true);
  assert.equal(app.calls.filter(call => call.url.endsWith('/messages/batchModify')).length, 0);
  assert.equal((await app.request('/api/inbox/cleanup', {method: 'POST', owner: OTHER, body: {stage: 'apply', previewToken: preview.previewToken}})).status, 409);
  assert.equal((await app.request('/api/inbox/cleanup', {method: 'POST', body: {stage: 'apply', previewToken: preview.previewToken}})).status, 200);
  assert.equal((await app.request('/api/inbox/cleanup', {method: 'POST', body: {stage: 'apply', previewToken: preview.previewToken}})).status, 409);
  const modification = app.calls.find(call => call.url.endsWith('/messages/batchModify'));
  assert.deepEqual(JSON.parse(modification.body), {ids: ['noise1'], removeLabelIds: ['INBOX']});
  assert.ok(!app.calls.some(call => call.method === 'DELETE' || /batchDelete|\/delete\b/.test(call.url)));
});

test('Gmail reconnect invalidates cleanup previews for the old mailbox', async () => {
  const app = fixture({messages: [mail('noise1', 'Unimportant')]}); await app.connect();
  const preview = await (await app.request('/api/inbox/cleanup', {method: 'POST', body: {stage: 'preview', messageIds: ['noise1'], operation: 'read'}})).json();
  app.setEmail('other-account@example.com'); await app.connect();
  assert.equal((await app.request('/api/inbox/cleanup', {method: 'POST', body: {stage: 'apply', previewToken: preview.previewToken}})).status, 409);
  assert.equal(app.calls.filter(call => call.url.endsWith('/messages/batchModify')).length, 0);
});

test('successful mailbox changes stay successful if their audit cannot be stored', async () => {
  const app = fixture({messages: [mail('noise1', 'Unimportant')]}); await app.connect();
  const preview = await (await app.request('/api/inbox/cleanup', {method: 'POST', body: {stage: 'preview', messageIds: ['noise1'], operation: 'trash'}})).json();
  app.db.failAudit();
  assert.equal((await app.request('/api/inbox/cleanup', {method: 'POST', body: {stage: 'apply', previewToken: preview.previewToken}})).status, 200);
  assert.deepEqual(JSON.parse(app.calls.find(call => call.url.endsWith('/messages/batchModify')).body), {ids: ['noise1'], addLabelIds: ['TRASH'], removeLabelIds: ['INBOX']});
});

test('disconnect removes encrypted credentials while retaining life history', async () => {
  const app = fixture(); await app.connect();
  await app.request('/api/life', {method: 'PUT', body: {state: createLifeState({custom: 'history'}), version: 0}});
  const result = await (await app.request('/api/inbox/disconnect', {method: 'POST'})).json();
  assert.equal(result.connected, false); assert.equal(result.revoked, true);
  assert.equal(app.db.raw.prepare('SELECT count(*) AS count FROM mailbox_accounts').get().count, 0);
  assert.equal((await (await app.request('/api/life')).json()).state.custom, 'history');
});

test('hourly entry remains dormant until a real scheduler is explicitly enabled', async () => {
  const app = fixture(); await app.connect();
  const before = app.calls.length;
  await app.worker.scheduled({}, app.env, {});
  assert.equal(app.calls.length, before);
});
