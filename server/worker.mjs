import * as LifeModel from '../dist/life-model.js';

// Every API is behind Sites' private access policy AND its authenticated-user
// header. Service-access bypass tokens deliberately do not establish identity.
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_LIFE_BYTES = 1024 * 1024;
const MAX_MESSAGES = 40;
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
const CLEANUP_OPERATIONS = new Set(['archive', 'read', 'trash']);
const METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

class HttpError extends Error {
  constructor(status, message, code = 'request_failed') {
    super(message); this.status = status; this.code = code;
  }
}

function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status, headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  });
}

function text(value, max = 2000) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function requireIdentity(request, env) {
  const owner = request.headers.get('oai-authenticated-user-id');
  if (!owner || owner.length > 300) throw new HttpError(401, 'Sign in with ChatGPT to use Cam’s Life.', 'sign_in_required');
  if (env.LIFE_OWNER_ID && owner !== env.LIFE_OWNER_ID) throw new HttpError(403, 'This app belongs to another account.', 'owner_only');
  return owner;
}

function requireOrigin(request) {
  if (!METHODS.has(request.method)) return;
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) {
    throw new HttpError(403, 'Open Cam’s Life and try this action again.', 'origin_rejected');
  }
}

async function bodyJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    throw new HttpError(415, 'Send a JSON request.', 'json_required');
  }
  if (Number(request.headers.get('content-length') || 0) > MAX_JSON_BYTES) {
    throw new HttpError(413, 'This request is too large.', 'request_too_large');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'This request is empty.', 'invalid_json');
  let size = 0; const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_JSON_BYTES) { await reader.cancel(); throw new HttpError(413, 'This request is too large.', 'request_too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error();
    return parsed;
  } catch { throw new HttpError(400, 'This request contains invalid JSON.', 'invalid_json'); }
}

function database(env) {
  if (!env.LIFE_DB?.prepare) throw new HttpError(503, 'Private storage has not been connected yet. Your existing health history is still available.', 'storage_not_configured');
  return env.LIFE_DB;
}

function base64url(bytes) {
  let encoded = ''; for (const b of bytes) encoded += String.fromCharCode(b);
  return btoa(encoded).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode64(input) {
  const raw = atob(input.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

async function digest(crypto, value) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}

function encryptionConfigured(env) {
  try { return decode64(env.LIFE_ENCRYPTION_KEY || '').byteLength === 32; } catch { return false; }
}

async function keyFor(crypto, env) {
  if (!encryptionConfigured(env)) throw new HttpError(503, 'Mailbox encryption has not been configured yet.', 'encryption_not_configured');
  return crypto.subtle.importKey('raw', decode64(env.LIFE_ENCRYPTION_KEY), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptSecret(crypto, env, owner, value) {
  const key = await keyFor(crypto, env), iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(owner)}, key, new TextEncoder().encode(value));
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(bytes))}`;
}

async function decryptSecret(crypto, env, owner, value) {
  const [version, iv, payload] = String(value || '').split('.');
  if (version !== 'v1' || !iv || !payload) throw new HttpError(503, 'Reconnect your mailbox to restore its encrypted connection.', 'mailbox_reconnect_required');
  try {
    const bytes = await crypto.subtle.decrypt({name: 'AES-GCM', iv: decode64(iv), additionalData: new TextEncoder().encode(owner)}, await keyFor(crypto, env), decode64(payload));
    return new TextDecoder().decode(bytes);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'Reconnect your mailbox to restore its encrypted connection.', 'mailbox_reconnect_required');
  }
}

function gmailConfigured(env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && encryptionConfigured(env) && env.LIFE_DB);
}

async function remoteJson(fetcher, url, options = {}, provider = 'Connection') {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetcher(url, {...options, signal: controller.signal});
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) throw new HttpError(429, `${provider} is busy or its quota is reached. Try again later.`, 'upstream_rate_limit');
      if ([401, 403].includes(response.status)) throw new HttpError(503, `${provider} needs a valid connection. Check settings and reconnect.`, 'upstream_auth_required');
      throw new HttpError(502, `${provider} could not complete this request. Try again shortly.`, 'upstream_failed');
    }
    const reader = response.body?.getReader();
    if (!reader) return {};
    const chunks = []; let size = 0;
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      // Provider responses are bounded to keep this compatible with Workers'
      // isolate memory limit, including very large Gmail HTML messages.
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new HttpError(502, `${provider} returned a response that is too large. Try a narrower mailbox search.`, 'upstream_response_too_large');
      }
      chunks.push(value);
    }
    if (!size) return {};
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
    try { return JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new HttpError(502, `${provider} returned a response that could not be read. Try again.`, 'upstream_invalid_response'); }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, `${provider} could not be reached. Try again shortly.`, 'upstream_unavailable');
  } finally {
    clearTimeout(timer);
  }
}

function createEmptyLife() {
  return LifeModel.createLifeState();
}

function checkLife(state) {
  try { return LifeModel.assertLifeState(state); }
  catch (error) { throw new HttpError(400, text(error.message, 600) || 'Check the saved life data.', 'invalid_life_state'); }
}

async function readLife(env, owner) {
  const row = await database(env).prepare('SELECT state_json, version, updated_at FROM life_state WHERE owner_id = ?').bind(owner).first();
  if (!row) return {state: createEmptyLife(), version: 0, updatedAt: null};
  try { return {state: checkLife(JSON.parse(row.state_json)), version: row.version, updatedAt: row.updated_at}; }
  catch { throw new HttpError(503, 'Your saved life data could not be loaded. Nothing has been overwritten.', 'saved_state_unavailable'); }
}

async function writeLife(env, owner, state, expectedVersion, now) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new HttpError(400, 'Include the version of the data you opened.', 'version_required');
  checkLife(state); const raw = JSON.stringify(state);
  if (new TextEncoder().encode(raw).byteLength > MAX_LIFE_BYTES) throw new HttpError(413, 'This life record is too large to save.', 'life_state_too_large');
  const db = database(env), updatedAt = now().toISOString();
  let result;
  if (expectedVersion === 0) {
    result = await db.prepare('INSERT INTO life_state (owner_id, state_json, version, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(owner_id) DO NOTHING').bind(owner, raw, updatedAt).run();
  } else {
    result = await db.prepare('UPDATE life_state SET state_json = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND version = ?').bind(raw, updatedAt, owner, expectedVersion).run();
  }
  if (!result.meta?.changes) throw new HttpError(409, 'Your life data changed in another session. Refresh and review the latest data before saving.', 'version_conflict');
  return {state, version: expectedVersion + 1, updatedAt};
}

async function accountFor(env, owner) {
  return database(env).prepare('SELECT encrypted_refresh_token, email, scopes, updated_at FROM mailbox_accounts WHERE owner_id = ?').bind(owner).first();
}

async function accessToken(env, owner, crypto, fetcher) {
  if (!gmailConfigured(env)) throw new HttpError(503, 'Gmail is not configured yet. Add the Google app settings and mailbox encryption key first.', 'gmail_not_configured');
  const account = await accountFor(env, owner);
  if (!account) throw new HttpError(409, 'Connect your Gmail account first.', 'mailbox_not_connected');
  const refresh = await decryptSecret(crypto, env, owner, account.encrypted_refresh_token);
  const response = await remoteJson(fetcher, 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token'}),
  }, 'Gmail');
  if (typeof response.access_token !== 'string') throw new HttpError(503, 'Reconnect Gmail to restore mailbox access.', 'mailbox_reconnect_required');
  return response.access_token;
}

async function gmail(fetcher, token, path, options = {}) {
  return remoteJson(fetcher, `https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...options, headers: {'authorization': `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {})},
  }, 'Gmail');
}

function normalizedMessage(message) {
  const normalized = LifeModel.normalizeGmailMessage(message);
  return {...normalized, body: text(normalized.body, 10000), snippet: text(normalized.snippet, 1000)};
}

async function limitedMap(items, limit, mapper) {
  const results = new Array(items.length); let index = 0;
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, async () => {
    for (;;) { const i = index++; if (i >= items.length) return; results[i] = await mapper(items[i], i); }
  }));
  return results;
}

async function syncInbox(env, owner, query, crypto, fetcher, now) {
  const token = await accessToken(env, owner, crypto, fetcher);
  const search = text(query || 'newer_than:30d -in:trash -in:spam', 500);
  const list = await gmail(fetcher, token, `messages?${new URLSearchParams({q: search, maxResults: String(MAX_MESSAGES)})}`);
  const ids = (list.messages || []).slice(0, MAX_MESSAGES).map(x => text(x.id, 200)).filter(Boolean);
  const messages = await limitedMap(ids, 5, async id => normalizedMessage(await gmail(fetcher, token, `messages/${encodeURIComponent(id)}?format=full`)));
  const current = await readLife(env, owner);
  const generatedAt = now().toISOString();
  const lastDigest = {...LifeModel.buildInboxDigest(messages, {generatedAt}), query: search, limited: Boolean(list.nextPageToken)};
  const tasks = [...current.state.tasks];
  for (const task of lastDigest.todos) {
    // A sync must never reopen a task the user already ticked off.
    if (!tasks.some(existing => existing.id === task.id)) tasks.push({...task, createdAt: generatedAt, updatedAt: generatedAt});
  }
  const state = {...current.state, emails: messages, lastDigest, tasks, deliveries: LifeModel.extractDeliveries(messages, current.state.deliveries)};
  const saved = await writeLife(env, owner, state, current.version, now);
  return {...saved, messages: messages.length, limited: Boolean(list.nextPageToken)};
}

async function connectInbox(request, env, owner, crypto, now) {
  if (!gmailConfigured(env)) throw new HttpError(503, 'Gmail is not configured yet. Add the Google app settings and mailbox encryption key first.', 'gmail_not_configured');
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const redirectUri = `${new URL(request.url).origin}/api/inbox/callback`;
  await database(env).prepare('INSERT INTO oauth_states (state_hash, owner_id, redirect_uri, expires_at) VALUES (?, ?, ?, ?)').bind(await digest(crypto, nonce), owner, redirectUri, now().getTime() + 10 * 60 * 1000).run();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', scope: GMAIL_SCOPE, state: nonce, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true'}).toString();
  return json({url: url.href});
}

async function callbackInbox(request, env, owner, crypto, fetcher, now) {
  if (!gmailConfigured(env)) throw new HttpError(503, 'Gmail is not configured yet.', 'gmail_not_configured');
  const url = new URL(request.url), nonce = url.searchParams.get('state') || '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(nonce)) throw new HttpError(400, 'This Gmail connection expired. Start again in Settings.', 'oauth_state_invalid');
  const hash = await digest(crypto, nonce), db = database(env);
  const state = await db.prepare('SELECT owner_id, redirect_uri, expires_at FROM oauth_states WHERE state_hash = ?').bind(hash).first();
  if (!state || state.owner_id !== owner || state.expires_at < now().getTime() || state.redirect_uri !== `${url.origin}/api/inbox/callback`) throw new HttpError(400, 'This Gmail connection expired. Start again in Settings.', 'oauth_state_invalid');
  // Consume state atomically before exchanging the authorization code.
  const used = await db.prepare('DELETE FROM oauth_states WHERE state_hash = ? AND owner_id = ? AND expires_at >= ?').bind(hash, owner, now().getTime()).run();
  if (!used.meta?.changes) throw new HttpError(400, 'This Gmail connection has already been used. Start again in Settings.', 'oauth_state_invalid');
  if (url.searchParams.has('error')) return Response.redirect(`${url.origin}/?connection=cancelled#inbox`, 303);
  const code = url.searchParams.get('code');
  if (!code || code.length > 3000) throw new HttpError(400, 'Google did not return a connection code. Try again.', 'oauth_code_missing');
  const tokens = await remoteJson(fetcher, 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: state.redirect_uri}),
  }, 'Gmail');
  if (typeof tokens.access_token !== 'string') throw new HttpError(503, 'Google did not return mailbox access. Try connecting again.', 'oauth_token_missing');
  if (!String(tokens.scope || '').split(' ').includes(GMAIL_SCOPE)) throw new HttpError(400, 'Allow Gmail access to connect your mailbox.', 'oauth_scope_missing');
  const prior = await accountFor(env, owner);
  const refresh = typeof tokens.refresh_token === 'string' ? await encryptSecret(crypto, env, owner, tokens.refresh_token) : prior?.encrypted_refresh_token;
  if (!refresh) throw new HttpError(409, 'Google did not provide offline access. Reconnect and allow Gmail access.', 'oauth_refresh_missing');
  const profile = await gmail(fetcher, tokens.access_token, 'profile');
  if (prior && !tokens.refresh_token && profile.emailAddress !== prior.email) throw new HttpError(409, 'Reconnect Gmail and allow offline access for this account.', 'oauth_refresh_missing');
  await db.batch([
    db.prepare('INSERT INTO mailbox_accounts (owner_id, encrypted_refresh_token, email, scopes, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET encrypted_refresh_token = excluded.encrypted_refresh_token, email = excluded.email, scopes = excluded.scopes, updated_at = excluded.updated_at').bind(owner, refresh, text(profile.emailAddress, 320), text(tokens.scope, 2000), now().toISOString()),
    // A preview made for the old connection must never affect a new mailbox.
    db.prepare('DELETE FROM cleanup_previews WHERE owner_id = ?').bind(owner),
  ]);
  return Response.redirect(`${url.origin}/?connection=connected#inbox`, 303);
}

function messageIds(input) {
  if (!Array.isArray(input) || !input.length || input.length > MAX_MESSAGES) throw new HttpError(400, 'Select between 1 and 40 messages to review.', 'invalid_message_ids');
  const ids = [...new Set(input)];
  if (!ids.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(id))) throw new HttpError(400, 'Select valid Gmail messages.', 'invalid_message_ids');
  return ids;
}

async function previewCleanup(env, owner, body, crypto, fetcher, now) {
  if (!CLEANUP_OPERATIONS.has(body.operation)) throw new HttpError(400, 'Choose archive, mark read, or move to trash.', 'invalid_cleanup_operation');
  const ids = messageIds(body.messageIds), token = await accessToken(env, owner, crypto, fetcher);
  const previews = await limitedMap(ids, 5, async id => {
    const message = normalizedMessage(await gmail(fetcher, token, `messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`));
    return {id: message.id, subject: message.subject, from: message.from, unread: message.unread, receivedAt: message.date};
  });
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(32))), expiresAt = now().getTime() + 10 * 60 * 1000;
  await database(env).prepare('INSERT INTO cleanup_previews (token_hash, owner_id, operation, message_ids_json, expires_at, used_at) VALUES (?, ?, ?, ?, ?, NULL)').bind(await digest(crypto, nonce), owner, body.operation, JSON.stringify(ids), expiresAt).run();
  return json({previewToken: nonce, operation: body.operation, messages: previews, expiresAt: new Date(expiresAt).toISOString(), requiresConfirmation: true});
}

async function applyCleanup(env, owner, body, crypto, fetcher, now) {
  const nonce = body.previewToken;
  if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) throw new HttpError(400, 'Review these messages before changing the mailbox.', 'cleanup_review_required');
  const db = database(env), hash = await digest(crypto, nonce);
  const preview = await db.prepare('SELECT operation, message_ids_json, expires_at, used_at FROM cleanup_previews WHERE token_hash = ? AND owner_id = ?').bind(hash, owner).first();
  if (!preview || preview.used_at || preview.expires_at < now().getTime()) throw new HttpError(409, 'This review expired or was already used. Preview the messages again.', 'cleanup_review_expired');
  const ids = messageIds(JSON.parse(preview.message_ids_json));
  if (!CLEANUP_OPERATIONS.has(preview.operation)) throw new HttpError(400, 'This mailbox operation is not supported.', 'invalid_cleanup_operation');
  const token = await accessToken(env, owner, crypto, fetcher);
  const used = await db.prepare('UPDATE cleanup_previews SET used_at = ? WHERE token_hash = ? AND owner_id = ? AND used_at IS NULL AND expires_at >= ?').bind(now().toISOString(), hash, owner, now().getTime()).run();
  if (!used.meta?.changes) throw new HttpError(409, 'This review expired or was already used. Preview the messages again.', 'cleanup_review_expired');
  const modifications = preview.operation === 'archive' ? {removeLabelIds: ['INBOX']} : preview.operation === 'read' ? {removeLabelIds: ['UNREAD']} : {addLabelIds: ['TRASH'], removeLabelIds: ['INBOX']};
  try {
    await gmail(fetcher, token, 'messages/batchModify', {method: 'POST', body: JSON.stringify({ids, ...modifications})});
  } catch {
    // Once sent to Gmail, a timeout cannot prove whether Gmail applied it.
    throw new HttpError(502, 'Gmail did not confirm this mailbox change. Refresh your inbox, then review any remaining messages again.', 'cleanup_outcome_unknown');
  }
  try {
    await db.prepare('INSERT INTO mailbox_audit (owner_id, operation, count, created_at) VALUES (?, ?, ?, ?)').bind(owner, preview.operation, ids.length, now().toISOString()).run();
  } catch {
    // A diagnostic failure cannot turn a completed Gmail action into a retry.
    console.error('Cam’s Life mailbox audit unavailable');
  }
  return json({operation: preview.operation, count: ids.length, refreshRequired: true});
}

async function disconnectInbox(env, owner, crypto, fetcher) {
  const db = database(env), account = await accountFor(env, owner); let revoked = false;
  if (account) {
    try {
      const refresh = await decryptSecret(crypto, env, owner, account.encrypted_refresh_token);
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const result = await fetcher('https://oauth2.googleapis.com/revoke', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({token: refresh}), signal: controller.signal});
        revoked = result.ok;
      } finally { clearTimeout(timeout); }
    } catch { /* Local removal must still succeed when Google is unreachable. */ }
    await db.prepare('DELETE FROM mailbox_accounts WHERE owner_id = ?').bind(owner).run();
    await db.prepare('DELETE FROM oauth_states WHERE owner_id = ?').bind(owner).run();
    await db.prepare('DELETE FROM cleanup_previews WHERE owner_id = ?').bind(owner).run();
  }
  return json({connected: false, revoked, message: revoked ? 'Gmail disconnected.' : 'Gmail disconnected here. If needed, remove access in your Google account too.'});
}

export function createWorker({fetcher = globalThis.fetch, crypto = globalThis.crypto, now = () => new Date()} = {}) {
  return {
    async fetch(request, env = {}, ctx = {}) {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/')) {
        const response = env.ASSETS?.fetch ? await env.ASSETS.fetch(request) : new Response('Not found', {status:404});
        if (!response.ok || response.redirected) return response;
        const headers = new Headers(response.headers);
        if (request.method === 'GET' && ['/', '/index.html'].includes(url.pathname) && (!response.url || new URL(response.url).origin === url.origin) && headers.get('Content-Type')?.startsWith('text/html')) headers.set('X-Cams-Life-Shell', '1');
        if (url.pathname === '/sw.js') {headers.set('Cache-Control','no-cache');headers.set('Service-Worker-Allowed','/');headers.set('Content-Type','text/javascript');}
        return new Response(response.body,{status:response.status,headers});
      }
      try {
        const owner = requireIdentity(request, env); requireOrigin(request);
        if (url.pathname === '/api/status' && request.method === 'GET') {
          const account = env.LIFE_DB ? await accountFor(env, owner) : null;
          const connected = Boolean(account);
          const hourly = Boolean(env.LIFE_SCHEDULER_ENABLED === 'true' && gmailConfigured(env) && account);
          return json({storage: Boolean(env.LIFE_DB), aiMode: 'subscription-handoff', aiConfigured: false, gmail: gmailConfigured(env), inboxConnected: connected, gmailConnected: connected, email: account?.email || null, hourlySync: hourly, hourlyEnabled: hourly});
        }
        if (url.pathname === '/api/life' && request.method === 'GET') return json(await readLife(env, owner));
        if (url.pathname === '/api/life' && request.method === 'PUT') {
          const body = await bodyJson(request);
          return json(await writeLife(env, owner, body.state, body.version, now));
        }
        if (url.pathname === '/api/inbox/connect' && request.method === 'POST') return await connectInbox(request, env, owner, crypto, now);
        if (url.pathname === '/api/inbox/callback' && request.method === 'GET') return await callbackInbox(request, env, owner, crypto, fetcher, now);
        if (url.pathname === '/api/inbox/sync' && request.method === 'POST') {
          const body = await bodyJson(request);
          return json(await syncInbox(env, owner, body.query, crypto, fetcher, now));
        }
        if (url.pathname === '/api/inbox/digest' && request.method === 'GET') {
          const saved = await readLife(env, owner); return json({digest: saved.state.lastDigest || null, updatedAt: saved.updatedAt});
        }
        if (url.pathname === '/api/inbox/disconnect' && request.method === 'POST') return await disconnectInbox(env, owner, crypto, fetcher);
        if (url.pathname === '/api/inbox/cleanup' && request.method === 'POST') {
          const body = await bodyJson(request);
          if (body.stage === 'preview') return await previewCleanup(env, owner, body, crypto, fetcher, now);
          if (body.stage === 'apply') return await applyCleanup(env, owner, body, crypto, fetcher, now);
          throw new HttpError(400, 'Review the selected messages before applying this mailbox action.', 'cleanup_review_required');
        }
        return json({error: 'This action is not available.', code: 'not_found'}, 404);
      } catch (error) {
        if (error instanceof HttpError) return json({error: error.message, code: error.code}, error.status);
        // Never log request bodies, provider errors, authorization codes or tokens.
        console.error('Cam’s Life API failed', {route: url.pathname, kind: error?.name || 'Error'});
        return json({error: 'This action could not be completed. Your saved data has not been replaced. Try again shortly.', code: 'service_unavailable'}, 503);
      }
    },
    async scheduled(event, env = {}, ctx = {}) {
      // Sites does not declare a cron binding today. This entry is inactive until
      // an actual hourly scheduler is configured and verified by the deployer.
      if (env.LIFE_SCHEDULER_ENABLED !== 'true' || !gmailConfigured(env)) return;
      const run = async () => {
        const accounts = await database(env).prepare('SELECT owner_id FROM mailbox_accounts').all();
        for (const account of accounts.results || []) {
          if (env.LIFE_OWNER_ID && account.owner_id !== env.LIFE_OWNER_ID) continue;
          try { await syncInbox(env, account.owner_id, null, crypto, fetcher, now); }
          catch (error) { console.error('Cam’s Life hourly sync failed', {kind: error?.name || 'Error'}); }
        }
        await database(env).batch([
          database(env).prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(now().getTime()),
          database(env).prepare('DELETE FROM cleanup_previews WHERE expires_at < ?').bind(now().getTime()),
        ]);
      };
      if (ctx.waitUntil) ctx.waitUntil(run()); else await run();
    },
  };
}

export default createWorker();
