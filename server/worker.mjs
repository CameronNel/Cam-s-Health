import * as LifeModel from '../dist/life-model.js';
import {healthActionSchema, healthSystemPrompt} from '../dist/health-intelligence.js';
import {buildAIContext, parseAIResponse} from '../dist/ai-checkin.js';

// Every API is behind Sites' private access policy AND its authenticated-user
// header. Service-access bypass tokens deliberately do not establish identity.
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_LIFE_BYTES = 1024 * 1024;
const MAX_MESSAGES = 40;
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
const CLEANUP_OPERATIONS = new Set(['archive', 'read', 'trash']);
const METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const AI_DAILY_LIMIT = 50;
const MAX_AI_BODY_BYTES = 1100 * 1024;
const GROQ_ERROR_CODES = new Set(['invalid_api_key', 'invalid_request_error', 'model_not_found', 'model_decommissioned', 'model_permission_blocked_org', 'model_permission_blocked_project', 'unsupported_parameter', 'unsupported_value', 'rate_limit_exceeded', 'context_length_exceeded', 'json_validate_failed', 'server_error']);
const GROQ_ERROR_PARAMS = new Set(['model', 'messages', 'response_format', 'response_format.json_schema', 'response_format.json_schema.schema', 'response_format.json_schema.strict', 'max_completion_tokens', 'reasoning_effort', 'include_reasoning', 'stream']);
const GROQ_NETWORK_CATEGORIES = new Map([['TypeError', 'type_error'], ['NetworkError', 'network_error'], ['SecurityError', 'security_error']]);

class HttpError extends Error {
  constructor(status, message, code = 'request_failed', providerDiagnostics = null) {
    super(message); this.status = status; this.code = code; this.providerDiagnostics = providerDiagnostics;
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

async function bodyJson(request, maxBytes = MAX_JSON_BYTES) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    throw new HttpError(415, 'Send a JSON request.', 'json_required');
  }
  if (Number(request.headers.get('content-length') || 0) > maxBytes) {
    throw new HttpError(413, 'This request is too large.', 'request_too_large');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'This request is empty.', 'invalid_json');
  let size = 0; const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, 'This request is too large.', 'request_too_large'); }
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

async function googleClient(env, owner, crypto) {
  if (!env.LIFE_DB || !encryptionConfigured(env)) return null;
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) return {clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, source: 'environment'};
  const row = await database(env).prepare('SELECT encrypted_client FROM mailbox_oauth_clients WHERE owner_id = ?').bind(owner).first();
  if (!row) return null;
  try {
    const client = JSON.parse(await decryptSecret(crypto, env, 'oauth-client:' + owner, row.encrypted_client));
    if (typeof client.clientId !== 'string' || typeof client.clientSecret !== 'string') throw Error();
    return {...client, source: 'settings'};
  } catch { throw new HttpError(503, 'Your Google app settings could not be opened. Import the client JSON again in Settings.', 'gmail_setup_unavailable'); }
}

async function gmailSetup(env, owner, crypto, origin) {
  const client = await googleClient(env, owner, crypto);
  return {configured: Boolean(client), source: client?.source || null, storageReady: Boolean(env.LIFE_DB), encryptionReady: encryptionConfigured(env), redirectUri: origin + '/api/inbox/callback'};
}

async function requireGoogleClient(env, owner, crypto) {
  const client = await googleClient(env, owner, crypto);
  if (!client) throw new HttpError(503, 'Finish the one-time Gmail setup in Settings, then connect your Google account.', 'gmail_not_configured');
  return client;
}

async function saveGoogleClient(request, env, owner, body, crypto, now) {
  const db = database(env);
  if (!encryptionConfigured(env)) throw new HttpError(503, 'Mailbox encryption needs to be enabled by the app owner before Google setup can be saved.', 'encryption_not_configured');
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) throw new HttpError(409, 'Google sign-in is already configured on the server. Use Connect Gmail.', 'gmail_setup_managed');
  if (await accountFor(env, owner)) throw new HttpError(409, 'Disconnect Gmail before replacing the Google app settings. Your saved tasks and deliveries stay intact.', 'gmail_setup_connected');
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
  const clientSecret = typeof body.clientSecret === 'string' ? body.clientSecret.trim() : '';
  const redirectUri = new URL(request.url).origin + '/api/inbox/callback';
  if (clientId.length > 300 || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId) || !/^[A-Za-z0-9_-]{8,512}$/.test(clientSecret)) throw new HttpError(400, 'Import the JSON for a Google Web application client, with a client ID and client secret.', 'gmail_client_invalid');
  if (!Array.isArray(body.redirectUris) || !body.redirectUris.includes(redirectUri)) throw new HttpError(400, 'Add the exact redirect address shown in Settings to your Google Web application client, then download its JSON again.', 'gmail_redirect_missing');
  const encrypted = await encryptSecret(crypto, env, 'oauth-client:' + owner, JSON.stringify({clientId, clientSecret}));
  await db.batch([
    db.prepare('INSERT INTO mailbox_oauth_clients (owner_id, encrypted_client, updated_at) VALUES (?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET encrypted_client = excluded.encrypted_client, updated_at = excluded.updated_at').bind(owner, encrypted, now().toISOString()),
    db.prepare('DELETE FROM oauth_states WHERE owner_id = ?').bind(owner),
  ]);
  return json({configured: true, message: 'Google app settings saved securely. Connect Gmail to grant mailbox access.'});
}

async function aiKey(env, owner, crypto) {
  const row = await database(env).prepare('SELECT encrypted_api_key FROM ai_connections WHERE owner_id = ?').bind(owner).first();
  if (!row) throw new HttpError(503, 'Connect your free Groq account in Settings to use the in-app AI.', 'ai_not_configured');
  try { return await decryptSecret(crypto, env, 'groq:' + owner, row.encrypted_api_key); }
  catch { throw new HttpError(503, 'Your AI connection could not be opened. Reconnect Groq in Settings.', 'ai_reconnect_required'); }
}

async function aiSetup(env, owner, crypto, now) {
  const storageReady = Boolean(env.LIFE_DB), encryptionReady = encryptionConfigured(env);
  let configured = false, reconnectRequired = false, usedToday = 0;
  if (storageReady) {
    const row = await database(env).prepare('SELECT encrypted_api_key FROM ai_connections WHERE owner_id = ?').bind(owner).first();
    if (row) {
      if (!encryptionReady) reconnectRequired = true;
      else {
        try { await decryptSecret(crypto, env, 'groq:' + owner, row.encrypted_api_key); configured = true; }
        catch { reconnectRequired = true; }
      }
    }
    const usage = await database(env).prepare('SELECT request_count FROM ai_daily_usage WHERE owner_id = ? AND usage_day = ?').bind(owner, now().toISOString().slice(0, 10)).first();
    usedToday = usage?.request_count || 0;
  }
  return {configured, provider: 'Groq', model: GROQ_MODEL, storageReady, encryptionReady, reconnectRequired, usedToday, dailyLimit: AI_DAILY_LIMIT, remainingToday: Math.max(0, AI_DAILY_LIMIT - usedToday)};
}

async function reserveAIRequest(env, owner, now) {
  // A single conditional UPSERT reserves usage before the provider call. Failed
  // calls and connection tests count too; concurrent requests cannot bypass it.
  const row = await database(env).prepare('INSERT INTO ai_daily_usage (owner_id, usage_day, request_count) VALUES (?, ?, 1) ON CONFLICT(owner_id, usage_day) DO UPDATE SET request_count = request_count + 1 WHERE request_count < ? RETURNING request_count').bind(owner, now().toISOString().slice(0, 10), AI_DAILY_LIMIT).first();
  if (!row) throw new HttpError(429, 'Today’s 50 AI requests have been used. Try again tomorrow. Groq’s own free limits also apply.', 'ai_daily_limit');
  return row.request_count;
}

async function groqErrorDiagnostics(response) {
  const diagnostics = {providerStatus: response.status};
  // Provider messages may contain reflected keys or health text. Read at most
  // 8 KiB to inspect only finite, known code/parameter values; never retain,
  // display or log the message, body, request, owner or arbitrary properties.
  const reader = response.body?.getReader();
  if (!reader) return diagnostics;
  try {
    let size = 0; const chunks = [];
    for (;;) {
      const {value, done} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 8192) {await reader.cancel(); return diagnostics;}
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
    const error = JSON.parse(new TextDecoder().decode(bytes))?.error;
    if (GROQ_ERROR_CODES.has(error?.code)) diagnostics.providerCode = error.code;
    if (GROQ_ERROR_PARAMS.has(error?.param)) diagnostics.providerParam = error.param;
  } catch { /* Invalid, interrupted or non-JSON error bodies add no diagnostics. */ }
  finally {reader.releaseLock();}
  return diagnostics;
}

function groqResponseError(diagnostics) {
  const status = diagnostics.providerStatus, code = diagnostics.providerCode;
  if (status === 429) return new HttpError(429, 'Groq’s free rate or token limit has been reached. Wait a little and try again; the app will not switch to a paid model.', 'ai_rate_limit', diagnostics);
  if (status === 401) return new HttpError(401, 'Groq rejected this API key. Check the key from console.groq.com/keys, then enter it again in Settings.', 'ai_key_invalid', diagnostics);
  if (status === 403) {
    if (code === 'model_permission_blocked_org') return new HttpError(403, 'Groq blocked GPT-OSS 120B for your organization. In Groq Settings → Organization → Limits, allow openai/gpt-oss-120b, then reconnect here. Keep the Free plan.', 'ai_model_permission_org', diagnostics);
    if (code === 'model_permission_blocked_project') return new HttpError(403, 'Groq blocked GPT-OSS 120B for your project. In Groq Settings → Projects → Limits, allow openai/gpt-oss-120b, then reconnect here. Keep the Free plan.', 'ai_model_permission_project', diagnostics);
    return new HttpError(403, 'Groq denied access to GPT-OSS 120B. Check your Groq account and project permissions, then reconnect in Settings.', 'ai_access_denied', diagnostics);
  }
  if (status === 404 || code === 'model_not_found' || code === 'model_decommissioned') return new HttpError(502, `Groq could not find or enable GPT-OSS 120B (HTTP ${status}). Check that this model is available to your Groq project. Your saved data and previous connection are unchanged.`, 'ai_model_unavailable', diagnostics);
  if ([400, 422].includes(status)) return new HttpError(502, `Groq rejected the AI request (HTTP ${status}). The app request needs checking. Your saved data and previous connection are unchanged.`, 'ai_request_rejected', diagnostics);
  if (status === 413) return new HttpError(502, 'Groq rejected the AI request because it is too large (HTTP 413). Try a shorter check-in. Your records have not changed.', 'ai_input_too_large', diagnostics);
  return new HttpError(502, `Groq could not complete this request (HTTP ${status}). Your records have not changed. Try again shortly.`, 'ai_provider_failed', diagnostics);
}

async function groqCompletion(fetcher, apiKey, payload) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 40000);
  try {
    // The destination, model and options are fixed here. Browser input cannot
    // enable provider tools, paid fallback models, redirects or automatic retries.
    const response = await fetcher(GROQ_URL, {
      // Workers supports follow/manual, rather than the browser's error mode.
      // Inspect redirects ourselves so the Authorization header stays here.
      method: 'POST', redirect: 'manual', signal: controller.signal,
      headers: {'content-type': 'application/json', authorization: 'Bearer ' + apiKey},
      body: JSON.stringify({model: GROQ_MODEL, reasoning_effort: 'low', include_reasoning: false, stream: false, ...payload}),
    });
    if ((response.status >= 300 && response.status <= 399) || response.redirected) {
      await response.body?.cancel();
      const diagnostics = {providerStatus: response.status};
      console.error('Cam’s Life Groq redirect rejected', diagnostics);
      throw new HttpError(502, 'Groq redirected the AI connection unexpectedly. The request was stopped to protect your key. Your records and previous connection are unchanged.', 'ai_redirect_rejected', diagnostics);
    }
    if (!response.ok) {
      const diagnostics = await groqErrorDiagnostics(response);
      console.error('Cam’s Life Groq request failed', diagnostics);
      throw groqResponseError(diagnostics);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new HttpError(502, 'Groq returned an empty response. Your records have not changed.', 'ai_invalid_response');
    const chunks = []; let size = 0;
    for (;;) {
      const {value, done} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 128 * 1024) {await reader.cancel(); throw new HttpError(502, 'Groq returned a response that is too large. Try a shorter check-in.', 'ai_invalid_response');}
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
    let result;
    try {result = JSON.parse(new TextDecoder().decode(bytes));}
    catch {throw new HttpError(502, 'Groq returned a response that could not be read. Your records have not changed.', 'ai_invalid_response');}
    const choice = result?.choices?.[0];
    if (choice?.finish_reason === 'length') throw new HttpError(502, 'This check-in exceeded the AI response limit. Try fewer items at once. Nothing has been saved.', 'ai_response_limit');
    if (choice?.message?.refusal) throw new HttpError(422, 'The AI could not interpret this check-in. Try describing the food, amount or reading plainly.', 'ai_refused');
    if (choice?.finish_reason !== 'stop' || typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) throw new HttpError(502, 'Groq returned an incomplete response. Your records have not changed.', 'ai_invalid_response');
    return choice.message.content;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const timeout = controller.signal.aborted || error?.name === 'AbortError';
    const category = timeout ? 'timeout' : GROQ_NETWORK_CATEGORIES.get(error?.name) || 'unavailable';
    console.error('Cam’s Life Groq connection failed', {category});
    if (timeout) throw new HttpError(504, 'The AI took too long to reply. Your records have not changed. Try again.', 'ai_timeout');
    throw new HttpError(502, 'Groq could not be reached. Check your connection and try again.', 'ai_unavailable');
  } finally {clearTimeout(timer);}
}

async function probeAI(fetcher, apiKey) {
  const content = await groqCompletion(fetcher, apiKey, {
    max_completion_tokens: 256,
    messages: [{role: 'system', content: 'Connection test only. Return ready=true using the supplied JSON schema.'}, {role: 'user', content: 'Confirm this connection works. This is synthetic test data.'}],
    response_format: {type: 'json_schema', json_schema: {name: 'cams_life_connection', strict: true, schema: {type: 'object', additionalProperties: false, properties: {ready: {type: 'boolean', enum: [true]}}, required: ['ready']}}},
  });
  try {
    const result = JSON.parse(content);
    if (!result || result.ready !== true || Object.keys(result).length !== 1) throw Error();
  } catch {throw new HttpError(502, 'Groq’s connection test could not be verified. Your previous connection has not changed.', 'ai_invalid_response');}
}

async function saveAISetup(env, owner, body, crypto, fetcher, now) {
  const db = database(env);
  if (!encryptionConfigured(env)) throw new HttpError(503, 'Private encryption must be enabled before an AI key can be saved.', 'encryption_not_configured');
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (Object.keys(body).some(key => key !== 'apiKey') || !/^gsk_[A-Za-z0-9_-]{16,508}$/.test(apiKey)) throw new HttpError(400, 'Enter a valid Groq API key from console.groq.com/keys.', 'ai_key_invalid');
  await reserveAIRequest(env, owner, now);
  await probeAI(fetcher, apiKey);
  const encrypted = await encryptSecret(crypto, env, 'groq:' + owner, apiKey);
  await db.prepare('INSERT INTO ai_connections (owner_id, encrypted_api_key, updated_at) VALUES (?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET encrypted_api_key = excluded.encrypted_api_key, updated_at = excluded.updated_at').bind(owner, encrypted, now().toISOString()).run();
  return json({configured: true, provider: 'Groq', model: GROQ_MODEL, message: 'Groq connected and tested. Your check-ins can now use the AI inside the app.'});
}

async function assistant(env, owner, body, crypto, fetcher, now) {
  if (Object.keys(body).some(key => !['message', 'date', 'health', 'conversation', 'pendingActions'].includes(key))) throw new HttpError(400, 'Send a text check-in with its selected health date. This AI model does not accept photos.', 'ai_input_invalid');
  if (typeof body.message !== 'string' || !body.message.trim()) throw new HttpError(400, 'Describe the food, activity or reading you want to record.', 'ai_input_invalid');
  let context;
  try {context = buildAIContext(body.health, body.date, {message: body.message, conversation: body.conversation, pendingActions: body.pendingActions});}
  catch (error) {throw new HttpError(400, text(error.message, 500) || 'Check the date and health records before asking the AI.', 'ai_input_invalid');}
  const payload = {
    max_completion_tokens: 2000,
    messages: [{role: 'system', content: healthSystemPrompt}, {role: 'user', content: JSON.stringify(context)}],
    response_format: {type: 'json_schema', json_schema: {name: 'cams_life_checkin', strict: true, schema: healthActionSchema}},
  };
  if (JSON.stringify(payload).length > 22000) throw new HttpError(400, 'This check-in has too much context for the free AI limit. Try a shorter message.', 'ai_input_too_large');
  const apiKey = await aiKey(env, owner, crypto);
  await reserveAIRequest(env, owner, now);
  const content = await groqCompletion(fetcher, apiKey, payload);
  let result;
  try {result = parseAIResponse(content, body.health, body.date, {message: body.message, conversation: body.conversation, pendingActions: body.pendingActions});}
  catch {throw new HttpError(502, 'The AI response did not pass the health checks. Nothing has been saved. Try clarifying the amounts or readings.', 'ai_invalid_actions');}
  return json({...result, provider: 'Groq', model: GROQ_MODEL});
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
  const client = await requireGoogleClient(env, owner, crypto);
  const account = await accountFor(env, owner);
  if (!account) throw new HttpError(409, 'Connect your Gmail account first.', 'mailbox_not_connected');
  const refresh = await decryptSecret(crypto, env, owner, account.encrypted_refresh_token);
  const response = await remoteJson(fetcher, 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id: client.clientId, client_secret: client.clientSecret, refresh_token: refresh, grant_type: 'refresh_token'}),
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
  const client = await requireGoogleClient(env, owner, crypto);
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const redirectUri = `${new URL(request.url).origin}/api/inbox/callback`;
  await database(env).prepare('INSERT INTO oauth_states (state_hash, owner_id, redirect_uri, expires_at) VALUES (?, ?, ?, ?)').bind(await digest(crypto, nonce), owner, redirectUri, now().getTime() + 10 * 60 * 1000).run();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({client_id: client.clientId, redirect_uri: redirectUri, response_type: 'code', scope: GMAIL_SCOPE, state: nonce, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true'}).toString();
  return json({url: url.href});
}

async function callbackInbox(request, env, owner, crypto, fetcher, now) {
  const client = await requireGoogleClient(env, owner, crypto);
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
    body: new URLSearchParams({client_id: client.clientId, client_secret: client.clientSecret, code, grant_type: 'authorization_code', redirect_uri: state.redirect_uri}),
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
        if (url.pathname === '/update.html') {headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');}
        return new Response(response.body,{status:response.status,headers});
      }
      try {
        const owner = requireIdentity(request, env); requireOrigin(request);
        if (url.pathname === '/api/status' && request.method === 'GET') {
          const account = env.LIFE_DB ? await accountFor(env, owner) : null;
          const setup = await gmailSetup(env, owner, crypto, url.origin);
          const ai = await aiSetup(env, owner, crypto, now);
          const connected = Boolean(account);
          const hourly = Boolean(env.LIFE_SCHEDULER_ENABLED === 'true' && setup.configured && account);
          return json({storage: Boolean(env.LIFE_DB), aiMode: 'groq', aiConfigured: ai.configured, aiSetup: ai, gmail: setup.configured, gmailSetup: setup, inboxConnected: connected, gmailConnected: connected, email: account?.email || null, hourlySync: hourly, hourlyEnabled: hourly});
        }
        if (url.pathname === '/api/ai/setup' && request.method === 'POST') return await saveAISetup(env, owner, await bodyJson(request, 4096), crypto, fetcher, now);
        if (url.pathname === '/api/ai/setup' && request.method === 'DELETE') {
          await database(env).prepare('DELETE FROM ai_connections WHERE owner_id = ?').bind(owner).run();
          return json({configured: false, message: 'Groq disconnected. All health and life records are still saved.'});
        }
        if (url.pathname === '/api/ai/test' && request.method === 'POST') {
          const apiKey = await aiKey(env, owner, crypto);
          await reserveAIRequest(env, owner, now); await probeAI(fetcher, apiKey);
          return json({configured: true, provider: 'Groq', model: GROQ_MODEL, message: 'Your Groq connection is working.'});
        }
        if (url.pathname === '/api/assistant' && request.method === 'POST') return await assistant(env, owner, await bodyJson(request, MAX_AI_BODY_BYTES), crypto, fetcher, now);
        if (url.pathname === '/api/life' && request.method === 'GET') return json(await readLife(env, owner));
        if (url.pathname === '/api/life' && request.method === 'PUT') {
          const body = await bodyJson(request);
          return json(await writeLife(env, owner, body.state, body.version, now));
        }
        if (url.pathname === '/api/inbox/setup' && request.method === 'POST') return await saveGoogleClient(request, env, owner, await bodyJson(request), crypto, now);
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
        if (error instanceof HttpError) return json({error: error.message, code: error.code, ...(error.providerDiagnostics || {})}, error.status);
        // Never log request bodies, provider errors, authorization codes or tokens.
        console.error('Cam’s Life API failed', {route: url.pathname, kind: error?.name || 'Error'});
        return json({error: 'This action could not be completed. Your saved data has not been replaced. Try again shortly.', code: 'service_unavailable'}, 503);
      }
    },
    async scheduled(event, env = {}, ctx = {}) {
      // Sites does not declare a cron binding today. This entry is inactive until
      // an actual hourly scheduler is configured and verified by the deployer.
      if (env.LIFE_SCHEDULER_ENABLED !== 'true' || !env.LIFE_DB || !encryptionConfigured(env)) return;
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
