/** Pure personal-life helpers. Mail content and this state belong in private storage. */
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value : '';
const clean = value => text(value).trim();
const validISO = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && isDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
const DAY = 86400000;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** Stable content ID; neither a security token nor an anonymization mechanism. */
export function stableId(prefix, value) {
  const input = typeof value === 'string' ? value : canonical(value);
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    a = Math.imul(a ^ input.charCodeAt(i), 0x01000193);
    b = Math.imul(b ^ input.charCodeAt(i), 0x85ebca6b);
  }
  return `${clean(prefix) || 'item'}-${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
}

export function createLifeState(existing = {}) {
  if (!object(existing)) throw new TypeError('Life state must be an object.');
  // A future version must be migrated explicitly, never silently downgraded.
  if (existing.version !== undefined && existing.version !== 1) throw new Error('Unsupported life-state version.');
  return { ...existing, version: 1, tasks: existing.tasks ?? [], deliveries: existing.deliveries ?? [], favorites: existing.favorites ?? [], lastDigest: existing.lastDigest ?? null };
}

export function inspectLifeState(state) {
  const errors = [];
  if (!object(state)) return { ok: false, errors: ['Life state must be an object.'] };
  if (state.version !== 1) errors.push('Unsupported life-state version.');
  for (const key of ['tasks', 'deliveries', 'favorites']) if (!Array.isArray(state[key])) errors.push(`${key} must be an array.`);
  const checkIDs = (items, name) => {
    const seen = new Set();
    for (const item of Array.isArray(items) ? items : []) {
      if (!object(item) || !clean(item.id)) errors.push(`${name} needs a non-empty ID.`);
      else if (seen.has(item.id)) errors.push(`Duplicate ${name} ID: ${item.id}.`);
      else seen.add(item.id);
    }
  };
  checkIDs(state.tasks, 'task'); checkIDs(state.deliveries, 'delivery');
  for (const task of Array.isArray(state.tasks) ? state.tasks : []) {
    if (!object(task)) continue;
    if (!clean(task.title)) errors.push('Task title is required.');
    if (!['open', 'done'].includes(task.status)) errors.push('Task status must be open or done.');
    if (task.dueDate != null && !isDate(task.dueDate)) errors.push('Task dueDate must be a valid YYYY-MM-DD.');
    for (const key of ['createdAt', 'updatedAt', 'completedAt']) if (task[key] != null && !validISO(task[key])) errors.push(`Task ${key} must be an ISO date.`);
  }
  for (const delivery of Array.isArray(state.deliveries) ? state.deliveries : []) {
    if (!object(delivery)) continue;
    if (!clean(delivery.title)) errors.push('Delivery title is required.');
    if (!['ordered', 'in_transit', 'ready_for_pickup', 'delivered', 'picked_up', 'cancelled', 'unknown'].includes(delivery.status)) errors.push('Invalid delivery status.');
    if (delivery.pickupDeadline != null && !isDate(delivery.pickupDeadline)) errors.push('Pickup deadline must be a valid YYYY-MM-DD.');
    if (delivery.pickupCode != null && !clean(delivery.pickupCode)) errors.push('Pickup code must be text or null.');
    if (delivery.sourceEmailIds != null && (!Array.isArray(delivery.sourceEmailIds) || delivery.sourceEmailIds.some(id => !clean(id)))) errors.push('Delivery sourceEmailIds must contain mail IDs.');
  }
  if (Array.isArray(state.favorites) && (state.favorites.some(id => !clean(id)) || new Set(state.favorites).size !== state.favorites.length)) errors.push('Favorites must contain unique non-empty fact IDs.');
  if (state.lastDigest !== null && !object(state.lastDigest)) errors.push('lastDigest must be an object or null.');
  return { ok: errors.length === 0, errors };
}

export function validateLifeState(state) {
  const result = inspectLifeState(state);
  if (!result.ok) throw new Error(result.errors.join(' '));
  return state;
}

export const assertLifeState = validateLifeState;

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function decode64(value) {
  try {
    const normalized = text(value).replace(/-/g, '+').replace(/_/g, '/');
    if (typeof Buffer !== 'undefined') return Buffer.from(normalized, 'base64').toString('utf8');
    const binary = atob(normalized);
    return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
  } catch { return ''; }
}

function stripHTML(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text(value).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(?:br|\/p|\/div|\/li)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
      if (entity.startsWith('#')) {
        const code = parseInt(entity.slice(entity[1].toLowerCase() === 'x' ? 2 : 1), entity[1].toLowerCase() === 'x' ? 16 : 10);
        return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
      }
      return entities[entity.toLowerCase()] || match;
    }).replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function headerMap(headers = []) {
  const result = {};
  if (Array.isArray(headers)) {
    for (const header of headers) if (clean(header?.name)) result[header.name.toLowerCase()] = text(header.value);
  } else if (object(headers)) {
    for (const [name, value] of Object.entries(headers)) result[name.toLowerCase()] = text(value);
  }
  return result;
}

function gmailBody(payload) {
  const plain = [], html = [];
  function visit(part) {
    if (!object(part) || part.filename || part.body?.attachmentId) return;
    const mime = text(part.mimeType).toLowerCase();
    if (part.body?.data) {
      if (mime === 'text/html') html.push(stripHTML(decode64(part.body.data)));
      else if (mime === 'text/plain' || !mime) plain.push(decode64(part.body.data).trim());
    }
    for (const child of part.parts || []) visit(child);
  }
  visit(payload);
  return (plain.length ? plain : html).filter(Boolean).join('\n\n');
}

function parseRaw(raw) {
  const decoded = decode64(raw);
  const breakAt = decoded.search(/\r?\n\r?\n/);
  if (breakAt < 0) return { headers: {}, body: '' };
  const headerBlock = decoded.slice(0, breakAt).replace(/\r?\n[ \t]+/g, ' ');
  const headers = {};
  for (const line of headerBlock.split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index > 0) headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim();
  }
  const content = decoded.slice(breakAt).replace(/^\r?\n\r?\n/, '');
  const type = text(headers['content-type']);
  if (/multipart\//i.test(type)) {
    const boundary = /boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(type);
    if (!boundary) return { headers, body: '' };
    const parts = content.split(`--${boundary[1] || boundary[2]}`).slice(1).filter(part => !part.startsWith('--'));
    const parsed = parts.map(part => {
      const value = part.replace(/^\r?\n/, '');
      const encoded = typeof Buffer !== 'undefined' ? Buffer.from(value).toString('base64') : btoa(unescape(encodeURIComponent(value)));
      return parseRaw(encoded);
    });
    const useful = parsed.filter(part => !/attachment/i.test(part.headers['content-disposition'] || ''));
    const plain = useful.filter(part => /text\/plain/i.test(part.headers['content-type'] || ''));
    return { headers, body: (plain.length ? plain : useful).map(part => part.body).filter(Boolean).join('\n\n') };
  }
  if (type && !/text\/(?:plain|html)/i.test(type)) return { headers, body: '' };
  let body = content;
  if (/base64/i.test(headers['content-transfer-encoding'] || '')) body = decode64(content);
  if (/quoted-printable/i.test(headers['content-transfer-encoding'] || '')) {
    const rawBytes = content.replace(/=\r?\n/g, '').replace(/=([\dA-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    // Quoted-printable represents byte values, not Unicode code points.
    body = new TextDecoder().decode(Uint8Array.from(rawBytes, character => character.charCodeAt(0)));
  }
  return { headers, body: /text\/html/i.test(type) ? stripHTML(body) : body.trim() };
}

function senderDetails(from) {
  const match = /^(.*?)\s*<([^>]+)>\s*$/.exec(clean(from));
  return { fromName: match ? match[1].replace(/^"|"$/g, '').trim() : '', fromEmail: (match ? match[2] : clean(from)).toLowerCase() };
}

export function normalizeGmailMessage(message = {}) {
  const raw = message.raw ? parseRaw(message.raw) : null;
  const headers = { ...(raw?.headers || {}), ...headerMap(message.payload?.headers || message.headers) };
  const from = clean(headers.from || message.from);
  const received = message.internalDate != null ? Number(message.internalDate) : NaN;
  const parsed = Number.isFinite(received) && received > 0 ? new Date(received) : new Date(headers.date || message.date || '');
  const date = Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  const labels = [...new Set(message.labelIds || message.labels || [])].filter(label => typeof label === 'string');
  const body = gmailBody(message.payload) || raw?.body || clean(message.body || message.text) || stripHTML(message.snippet || '');
  const subject = clean(headers.subject || message.subject);
  const hasAttachments = part => !!part && (Boolean(part.filename) || (part.parts || []).some(hasAttachments));
  return {
    id: clean(message.id) || stableId('mail', [headers['message-id'], from, subject, date, body]),
    threadId: clean(message.threadId) || null, subject, from, ...senderDetails(from), to: clean(headers.to || message.to), date,
    body, snippet: stripHTML(message.snippet || body.slice(0, 240)), labels,
    unread: labels.includes('UNREAD') || (typeof message.unread === 'boolean' && message.unread),
    headers, hasAttachments: hasAttachments(message.payload),
    url: clean(message.url) || (clean(message.id) ? `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(message.threadId || message.id)}` : null),
  };
}

export const normalizeEmail = normalizeGmailMessage;

function noiseCategory(email) {
  const content = `${email.subject}\n${email.body}`.toLowerCase();
  const domain = email.fromEmail.split('@').at(-1);
  const github = domain === 'github.com' || domain?.endsWith('.github.com');
  const openai = ['openai.com', 'chatgpt.com', 'tm.openai.com'].includes(domain) || domain?.endsWith('.openai.com');
  if ((github || openai) && /\bcodex\b/.test(content) && /auto(?:matic)?[ -]?(?:approval[ -]?)?review|automatic approval review|automated review/.test(content)) return { category: 'codex_auto_review', reason: 'Codex automatic review notification from a recognized sender domain.' };
  if (github && /\b(?:workflow run|github actions|check suite|dependabot|automated review)\b/.test(content)) return { category: 'github_automated', reason: 'GitHub automated workflow or bot notification.' };
  const list = Boolean(clean(email.headers['list-unsubscribe']) || clean(email.headers['list-id']));
  const bulk = /^(?:bulk|list)$/i.test(clean(email.headers.precedence));
  const newsletter = /\bnewsletter\b|\bweekly digest\b|\bmonthly digest\b|nieuwsbrief/i.test(email.subject);
  const unsubscribe = /\bunsubscribe\b|\bafmelden\b|uitschrijven/i.test(email.body);
  if (list || (newsletter && (bulk || unsubscribe))) return { category: 'newsletter', reason: 'Mailing-list headers or an identified newsletter with an unsubscribe link.' };
  if (email.labels.includes('CATEGORY_PROMOTIONS') && unsubscribe && /\bsale\b|discount|offer ends|\boff\b|korting|aanbieding/i.test(content)) return { category: 'promotion', reason: 'Gmail promotion category with promotional content and an unsubscribe option.' };
  return null;
}

export function classifyEmail(input) {
  const email = normalizeEmail(input);
  const content = `${email.subject}\n${email.body}`;
  // Action cues win over noise: a failed workflow or urgent mailing-list notice can matter.
  const action = /\b(?:action required|requires? your attention|reply (?:by|required)|please (?:reply|respond|confirm)|payment (?:due|overdue)|invoice (?:due|overdue)|final notice|appointment confirmation required|workflow (?:run )?failed)\b|actie vereist|betaling vereist|reageer voor|bevestig (?:je|uw)|laatste herinnering/i.test(content);
  if (action) return { category: 'action', noiseCategory: null, reason: 'The email explicitly asks for an action or reports a failed workflow.' };
  const noise = noiseCategory(email);
  if (noise) return { category: 'noise', noiseCategory: noise.category, reason: noise.reason };
  if (/\b(?:ready (?:for|to) collect|ready for pickup|collect your|pick up your)\b|klaar om af te halen|klaar voor (?:afhalen|ophalen)|afhaalcode|ophaalcode|cipio/i.test(content)) return { category: 'action', noiseCategory: null, reason: 'A package may be ready to collect; check the email for pickup instructions.' };
  return { category: 'updates', noiseCategory: null, reason: 'No supported automatic cleanup category or explicit action was identified.' };
}

export function buildInboxDigest(inputs = [], options = {}) {
  const emails = dedupeEmails(inputs);
  const digest = { generatedAt: options.generatedAt || new Date().toISOString(), total: emails.length, unread: emails.filter(email => email.unread).length, action: [], updates: [], noise: [], todos: [] };
  for (const email of emails) {
    const classification = classifyEmail(email);
    const summary = { id: email.id, subject: email.subject || '(No subject)', from: email.fromName || email.fromEmail, date: email.date, unread: email.unread, url: email.url, reason: classification.reason, noiseCategory: classification.noiseCategory };
    digest[classification.category].push(summary);
    if (classification.category === 'action') digest.todos.push({ id: stableId('task-mail', email.id), title: email.subject || 'Review email', status: 'open', source: 'email', sourceEmailId: email.id, dueDate: parseEmailDueDate(email), sourceURL: email.url });
  }
  digest.counts = { action: digest.action.length, updates: digest.updates.length, noise: digest.noise.length };
  return digest;
}

function dedupeEmails(inputs) {
  const emails = new Map();
  for (const input of Array.isArray(inputs) ? inputs : []) {
    const email = normalizeEmail(input);
    if (!emails.has(email.id)) emails.set(email.id, email);
  }
  return [...emails.values()].sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.id.localeCompare(b.id));
}

/** Review-only selection. Calling this function cannot change a mailbox. */
export function buildCleanupPreview(inputs = [], query = '') {
  const instruction = clean(query).toLowerCase();
  const requested = new Set();
  if (/codex|auto(?:matic)?[ -]?(?:approval[ -]?)?review/i.test(instruction)) requested.add('codex_auto_review');
  if (/github|workflow|dependabot/i.test(instruction)) requested.add('github_automated');
  if (/newsletter|nieuwsbrief|mailing[ -]?list/i.test(instruction)) requested.add('newsletter');
  if (/promotion|marketing|sale|reclame|aanbieding/i.test(instruction)) requested.add('promotion');
  const broadNoise = /useless|noise|junk|rommel|spam|unread bs|onnodig|unnecessary|cleanup|clean up/i.test(instruction);
  if (broadNoise && requested.size === 0) ['codex_auto_review', 'github_automated', 'newsletter', 'promotion'].forEach(category => requested.add(category));
  const unreadOnly = /unread|ongelezen/i.test(instruction);
  const proposed = [];
  for (const email of dedupeEmails(inputs)) {
    const classification = classifyEmail(email);
    if (classification.category !== 'noise' || !requested.has(classification.noiseCategory) || (unreadOnly && !email.unread)) continue;
    proposed.push({ id: email.id, subject: email.subject || '(No subject)', from: email.fromEmail, category: classification.noiseCategory, reason: classification.reason, unread: email.unread });
  }
  return { query: clean(query), requiresReview: true, destructive: false, action: 'preview', proposed, ids: proposed.map(email => email.id), count: proposed.length, categories: [...requested], unsupportedReason: requested.size ? null : 'Name a supported noise category, such as newsletters or Codex automatic reviews. Other emails are excluded.' };
}

const MONTHS = { january: 1, jan: 1, januari: 1, february: 2, feb: 2, februari: 2, march: 3, mar: 3, maart: 3, april: 4, apr: 4, may: 5, mei: 5, june: 6, jun: 6, juni: 6, july: 7, jul: 7, juli: 7, august: 8, aug: 8, augustus: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10, oktober: 10, november: 11, nov: 11, december: 12, dec: 12 };

function dateFromLine(line) {
  let match = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(line);
  if (match) { const value = `${match[1]}-${match[2]}-${match[3]}`; return isDate(value) ? value : null; }
  match = /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/.exec(line);
  if (match) {
    // Dutch day-first dates are explicit only when the email is Dutch or the day exceeds 12.
    if (Number(match[1]) <= 12 && !/afhalen|ophalen|uiterlijk|tot en met|vóór/i.test(line)) return null;
    const value = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    return isDate(value) ? value : null;
  }
  match = /\b(\d{1,2})\s+([a-z]+)\s+(20\d{2})\b/i.exec(line);
  if (match && MONTHS[match[2].toLowerCase()]) {
    const value = `${match[3]}-${String(MONTHS[match[2].toLowerCase()]).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    return isDate(value) ? value : null;
  }
  match = /\b([a-z]+)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(line);
  if (match && MONTHS[match[1].toLowerCase()]) {
    const value = `${match[3]}-${String(MONTHS[match[1].toLowerCase()]).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
    return isDate(value) ? value : null;
  }
  return null;
}

function deadlineFrom(content) {
  for (const line of content.split(/\n/)) {
    if (!/\b(?:deadline|collect by|pick up by|until|before|uiterlijk|tot en met|vóór|voor)\b/i.test(line)) continue;
    const date = dateFromLine(line);
    if (date) return date;
  }
  return null;
}

/** Only a fully specified date next to an explicit action/deadline is extracted. */
export function parseEmailDueDate(input) {
  const email = normalizeEmail(input);
  const content = `${email.subject}\n${email.body}`;
  for (const line of content.split(/\n/)) {
    if (!/\b(?:reply|respond|confirm|payment|invoice|deadline|collect|pick up|afhalen|ophalen|reageer|betalen|betaling)\b/i.test(line)) continue;
    if (!/\b(?:by|due|before|until|deadline|voor|uiterlijk|tot en met)\b/i.test(line)) continue;
    const date = dateFromLine(line);
    if (date) return date;
  }
  return null;
}

export function parsePickup(input) {
  const email = typeof input === 'string' ? normalizeEmail({ body: input }) : normalizeEmail(input);
  const content = `${email.subject}\n${email.body}`;
  // Restrict codes to explicitly labelled pickup/PIN contexts. Tracking IDs are separate.
  const label = /(?:afhaal[ -]*code|ophaal[ -]*code|pickup[ -]*code|pick-up[ -]*code|collection[ -]*code|collect[ -]*code|cipio[ -]*(?:code)?|(?:afhaal|pickup|collection)[ -]?pin(?:code)?|pincode|pin\s*code)\s*(?:is|:|=|-)?\s*([A-Z0-9](?:[A-Z0-9 -]{2,23}[A-Z0-9]))\b/i.exec(content);
  let pickupCode = label ? label[1].trim() : null;
  if (pickupCode) {
    // Stop at prose following the token, while preserving labelled digit groups.
    const tokens = pickupCode.split(/\s+/);
    if (tokens.length > 1 && !tokens.every(token => /^\d+$/.test(token))) pickupCode = tokens[0];
    if ((!/\d/.test(pickupCode) && !/^[A-Z-]{4,24}$/.test(pickupCode)) || pickupCode.length > 24) pickupCode = null;
  }
  const locationLine = content.split(/\n/).find(line => /(?:pickup (?:location|point)|collection point|afhaal(?:punt|locatie)|ophaalpunt)\s*:/i.test(line));
  const pickupLocation = locationLine ? clean(locationLine.replace(/^.*?(?:pickup (?:location|point)|collection point|afhaal(?:punt|locatie)|ophaalpunt)\s*:/i, '')) || null : null;
  const ready = /\b(?:ready for (?:pickup|collection)|ready (?:to|for) collect|available for (?:pickup|collection)|collect your (?:parcel|package)|pick up your (?:parcel|package))\b|klaar om af te halen|klaar voor (?:afhalen|ophalen)|ligt klaar|kan worden afgehaald/i.test(content);
  return { pickupCode, pickupDeadline: deadlineFrom(content), pickupLocation, ready };
}

function trackingFrom(content) {
  const pattern = /(?:tracking(?:\s*(?:number|no\.?|id|code))?|track[ -]?(?:and[ -]?)?trace(?:\s*code)?|track & trace(?:\s*code)?|zendingsnummer|zendingnummer|pakketnummer|barcode)\s*(?:is|:|#|=|-)?\s*([A-Z0-9][A-Z0-9-]{5,39})\b/gi;
  for (const match of content.matchAll(pattern)) if (/\d/.test(match[1])) return match[1].toUpperCase();
  return null;
}

function orderFrom(content) {
  const pattern = /(?:order(?:\s*(?:number|no\.?|id|reference))?|bestel(?:nummer|lingsnummer)|bestelling(?:snummer)?|orderreferentie)\s*(?:is|:|#|=|-)?\s*([A-Z0-9][A-Z0-9-]{3,39})\b/gi;
  for (const match of content.matchAll(pattern)) if (/\d/.test(match[1])) return match[1].toUpperCase();
  return null;
}

function carrierFrom(content, sender) {
  for (const [name, pattern] of [['PostNL', /\bpostnl\b/i], ['DHL', /\bdhl\b/i], ['DPD', /\bdpd\b/i], ['UPS', /\bups\b/i], ['FedEx', /\bfedex\b/i], ['GLS', /\bgls\b/i], ['bpost', /\bbpost\b/i], ['Amazon', /\bamazon\b/i]]) if (pattern.test(`${sender}\n${content}`)) return name;
  return null;
}

function deliveryStatus(content, pickup) {
  if (/\b(?:order|shipment|delivery) (?:has been |was |is )?cancelled\b|bestelling (?:is )?geannuleerd/i.test(content)) return 'cancelled';
  if (/\b(?:parcel|package|order) (?:has been |was |is )?(?:picked up|collected)\b|(?:pakket|bestelling) (?:is )?(?:opgehaald|afgehaald)/i.test(content)) return 'picked_up';
  // "Delivered to pickup point" is a pickup step, not a completed home delivery.
  if (pickup.ready || /\bdelivered to (?:a |the |your )?(?:pickup|collection|parcel shop)|bezorgd bij (?:het |een )?(?:afhaalpunt|pakketpunt)/i.test(content)) return 'ready_for_pickup';
  if (/\b(?:parcel|package|order|shipment) (?:has been |was |is )?delivered\b|\b(?:your delivery is complete|delivery completed)\b|(?:pakket|bestelling) (?:is )?bezorgd/i.test(content)) return 'delivered';
  if (/\b(?:shipped|dispatched|in transit|out for delivery|on its way)\b|onderweg|verzonden/i.test(content)) return 'in_transit';
  if (/\border (?:confirmed|received)|order confirmation\b|bestelbevestiging|bestelling ontvangen/i.test(content)) return 'ordered';
  return 'unknown';
}

function scopedOrder(delivery) {
  if (!delivery.orderReference) return null;
  // Different shops can issue the same short order number.
  return `${delivery.merchantDomain || delivery.carrier || 'unknown'}:${delivery.orderReference.toUpperCase()}`;
}

export function extractDeliveries(inputs = [], previous = []) {
  const candidates = [];
  for (const email of dedupeEmails(inputs)) {
    const content = `${email.subject}\n${email.body}`;
    const pickup = parsePickup(email);
    const trackingNumber = trackingFrom(content), orderReference = orderFrom(content);
    const packageContext = /\b(?:parcel|package|shipment|delivery|tracking|shipped|dispatched|pickup|collection point|order confirmation)\b|pakket|zending|bezorg|afhaal|ophaal|bestelbevestiging/i.test(content);
    if (!packageContext || (!trackingNumber && !orderReference && !pickup.pickupCode && !pickup.ready)) continue;
    const carrier = carrierFrom(content, email.fromEmail);
    const merchantDomain = email.fromEmail.includes('@') ? email.fromEmail.split('@').at(-1) : null;
    const identity = trackingNumber ? `tracking:${trackingNumber}` : orderReference ? `order:${merchantDomain || carrier || 'unknown'}:${orderReference}` : `email:${email.threadId || email.id}`;
    candidates.push({
      id: stableId('delivery', identity), title: email.subject || (carrier ? `${carrier} package` : 'Package'),
      carrier, merchantDomain, trackingNumber, orderReference, ...pickup,
      status: deliveryStatus(content, pickup), sourceEmailIds: [email.id], sourceURL: email.url,
      firstSeenAt: email.date, updatedAt: email.date, completedAt: null,
    });
  }
  return mergeDeliveries(previous, candidates);
}

const finalStatuses = new Set(['picked_up', 'delivered', 'cancelled']);
const statusRank = { unknown: 0, ordered: 1, in_transit: 2, ready_for_pickup: 3, delivered: 4, picked_up: 4, cancelled: 4 };

export function mergeDeliveries(previous = [], incoming = []) {
  const result = previous.map(delivery => ({ ...delivery, sourceEmailIds: [...(delivery.sourceEmailIds || [])] }));
  // Oldest first means the latest message supplies the latest known fields.
  const ordered = [...incoming].sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
  for (const candidate of ordered) {
    const index = result.findIndex(delivery => delivery.id === candidate.id ||
      (delivery.trackingNumber && candidate.trackingNumber && delivery.trackingNumber.toUpperCase() === candidate.trackingNumber.toUpperCase()) ||
      (scopedOrder(delivery) && scopedOrder(delivery) === scopedOrder(candidate) && !(delivery.trackingNumber && candidate.trackingNumber && delivery.trackingNumber !== candidate.trackingNumber)) ||
      (delivery.sourceEmailIds || []).some(id => candidate.sourceEmailIds?.includes(id)));
    if (index < 0) { result.push({ ...candidate }); continue; }
    const existing = result[index];
    const newer = !existing.updatedAt || !candidate.updatedAt || candidate.updatedAt >= existing.updatedAt;
    const merged = { ...existing };
    for (const [key, value] of Object.entries(candidate)) if (value != null && value !== '' && !['id', 'status', 'sourceEmailIds', 'firstSeenAt'].includes(key) && (newer || merged[key] == null)) merged[key] = value;
    merged.sourceEmailIds = [...new Set([...(existing.sourceEmailIds || []), ...(candidate.sourceEmailIds || [])])];
    merged.firstSeenAt = [existing.firstSeenAt, candidate.firstSeenAt].filter(Boolean).sort()[0] || null;
    // Once completed in the app, a sync must never reactivate the package.
    merged.status = finalStatuses.has(existing.status) ? existing.status : (statusRank[candidate.status] || 0) >= (statusRank[existing.status] || 0) ? candidate.status : existing.status;
    result[index] = merged;
  }
  return result.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || a.id.localeCompare(b.id));
}

export function markDeliveryPickedUp(deliveries, id, now = new Date().toISOString()) {
  if (!validISO(now)) throw new Error('A valid completion time is required.');
  if (!deliveries.some(delivery => delivery.id === id)) throw new Error('Delivery not found.');
  return deliveries.map(delivery => delivery.id === id ? { ...delivery, status: 'picked_up', completedAt: now, updatedAt: now } : delivery);
}

export function upsertTask(stateOrTasks = [], changes = {}, now = new Date().toISOString()) {
  const isState = object(stateOrTasks);
  const tasks = isState ? stateOrTasks.tasks : stateOrTasks;
  if (!Array.isArray(tasks) || !object(changes)) throw new TypeError('Tasks and a task object are required.');
  if (!validISO(now)) throw new Error('A valid task update time is required.');
  const title = clean(changes.title);
  const id = clean(changes.id) || (changes.sourceEmailId ? stableId('task-mail', changes.sourceEmailId) : stableId('task', [title, now]));
  const existing = tasks.find(task => task.id === id);
  const status = changes.status ?? existing?.status ?? 'open';
  const task = { ...existing, ...changes, id, title: title || existing?.title || '', status, dueDate: changes.dueDate !== undefined ? changes.dueDate : existing?.dueDate ?? null, createdAt: existing?.createdAt || now, updatedAt: now, completedAt: status === 'done' ? existing?.completedAt || now : null };
  validateLifeState({ version: 1, tasks: [task], deliveries: [], favorites: [], lastDigest: null });
  const next = existing ? tasks.map(item => item.id === id ? task : item) : [...tasks, task];
  return isState ? { ...stateOrTasks, tasks: next } : next;
}

export function removeTask(stateOrTasks, id) {
  const isState = object(stateOrTasks);
  const tasks = isState ? stateOrTasks.tasks : stateOrTasks;
  const next = tasks.filter(task => task.id !== id);
  return isState ? { ...stateOrTasks, tasks: next } : next;
}
export function toggleTask(stateOrTasks, id, now = new Date().toISOString()) {
  const tasks = object(stateOrTasks) ? stateOrTasks.tasks : stateOrTasks;
  const task = tasks.find(item => item.id === id);
  if (!task) throw new Error('Task not found.');
  return upsertTask(stateOrTasks, { id, status: task.status === 'done' ? 'open' : 'done' }, now);
}

export const FACTS = Object.freeze([
  { id: 'venus-day', category: 'Space', title: 'Venus takes longer to spin than to orbit', body: 'Venus needs about 243 Earth days to rotate once relative to the stars, but about 225 Earth days to orbit the Sun. Its sunrise-to-sunrise day is different: about 117 Earth days.', sourceTitle: 'NASA · Venus facts', sourceURL: 'https://science.nasa.gov/venus/facts/' },
  { id: 'sunlight-time', category: 'Space', title: 'You see the Sun as it was eight minutes ago', body: 'Sunlight takes about 8 minutes and 20 seconds to reach Earth. Looking at the Sun means seeing light that left it several minutes earlier.', sourceTitle: 'NASA · Sun facts', sourceURL: 'https://science.nasa.gov/sun/facts/' },
  { id: 'moon-recession', category: 'Space', title: 'The Moon is slowly leaving us', body: 'Laser measurements show that the Moon moves away from Earth by about 3.8 centimetres per year. The rate is a present-day measurement, not a constant for all lunar history.', sourceTitle: 'NASA · Moon facts', sourceURL: 'https://science.nasa.gov/moon/facts/' },
  { id: 'gps-relativity', category: 'Physics', title: 'GPS depends on Einstein', body: 'A GPS satellite clock runs about 38 microseconds faster per day than a comparable clock on Earth after the effects of gravity and motion are combined. GPS corrects for those effects to keep positions accurate.', sourceTitle: 'Neil Ashby · Relativity in the Global Positioning System', sourceURL: 'https://link.springer.com/article/10.12942/lrr-2003-1' },
  { id: 'iss-sunrises', category: 'Space', title: 'Sixteen sunrises in a single day', body: 'The International Space Station completes an orbit of Earth roughly every 90 minutes. Its crew can see about 16 sunrises and sunsets in 24 hours.', sourceTitle: 'NASA · International Space Station facts and figures', sourceURL: 'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/' },
  { id: 'pulsar-planets', category: 'Space', title: 'The first confirmed exoplanets orbited a dead star', body: 'The first confirmed planets outside our solar system were announced in 1992 around a pulsar: a rapidly spinning neutron star left behind by a stellar explosion.', sourceTitle: 'NASA · Exoplanet discovery history', sourceURL: 'https://science.nasa.gov/exoplanets/discoveries/' },
  { id: 'octopus-hearts', category: 'Nature', title: 'An octopus has three hearts', body: 'Two hearts pump blood through an octopus’s gills. The third pumps blood to the rest of its body.', sourceTitle: 'Smithsonian Ocean · Octopus', sourceURL: 'https://ocean.si.edu/ocean-life/invertebrates/octopus' },
  { id: 'bee-dance', category: 'Nature', title: 'Bees can dance a map', body: 'Honeybees use the waggle dance to communicate the direction and distance of a food source. Karl von Frisch shared the 1973 Nobel Prize for work that included decoding this communication.', sourceTitle: 'Nobel Prize · Karl von Frisch facts', sourceURL: 'https://www.nobelprize.org/prizes/medicine/1973/frisch/facts/' },
  { id: 'water-four-degrees', category: 'Physics', title: 'Water gets denser, then changes its mind', body: 'Fresh water reaches its maximum density at about 4°C. Cooling it below that temperature makes it expand, helping explain why lakes freeze from the surface.', sourceTitle: 'USGS · Water density', sourceURL: 'https://www.usgs.gov/special-topics/water-science-school/science/water-density' },
  { id: 'lightning-heat', category: 'Earth', title: 'Lightning briefly heats air beyond the Sun’s surface', body: 'Air in a lightning channel can reach about 50,000°F, or 28,000°C. That is several times hotter than the surface of the Sun, though only in a narrow channel for a very short time.', sourceTitle: 'NOAA National Weather Service · Lightning science', sourceURL: 'https://www.weather.gov/safety/lightning-science' },
  { id: 'ocean-coverage', category: 'Earth', title: 'Most of our planet is ocean', body: 'The ocean covers about 71% of Earth’s surface and holds about 97% of Earth’s water. Land is a minority of the planet’s visible surface.', sourceTitle: 'NOAA · How much water is in the ocean?', sourceURL: 'https://oceanservice.noaa.gov/facts/oceanwater.html' },
  { id: 'earth-core', category: 'Earth', title: 'Earth’s metal core is both liquid and solid', body: 'Earth has a liquid outer core and a solid inner core. Despite its enormous temperature, the inner core stays solid because of the immense pressure.', sourceTitle: 'USGS · Inside the Earth', sourceURL: 'https://pubs.usgs.gov/gip/dynamic/inside.html' },
  { id: 'solar-orbit', category: 'Space', title: 'A year around our galaxy lasts hundreds of millions of years', body: 'The Sun and solar system take roughly 230 million years to travel once around the centre of the Milky Way.', sourceTitle: 'NASA · Sun facts', sourceURL: 'https://science.nasa.gov/sun/facts/' },
  { id: 'bats-flight', category: 'Nature', title: 'Bats are the only mammals with powered flight', body: 'Flying squirrels glide, but bats generate sustained flight by flapping their wings. They are the only mammals capable of true powered flight.', sourceTitle: 'USGS · Bats', sourceURL: 'https://www.usgs.gov/faqs/why-are-bats-important' },
  { id: 'dna-length', category: 'Biology', title: 'A cell can pack metres of DNA', body: 'If stretched out, the DNA in a typical human body cell is about two metres long. It fits because DNA wraps around proteins and folds into compact chromosomes.', sourceTitle: 'NHGRI · Chromosomes fact sheet', sourceURL: 'https://www.genome.gov/about-genomics/fact-sheets/Chromosomes-Fact-Sheet' },
  { id: 'mitochondrial-dna', category: 'Biology', title: 'Your cells carry two kinds of genome', body: 'Most human DNA sits in the nucleus, but mitochondria have their own small genome. Human mitochondrial DNA contains 37 genes and is normally inherited from the mother.', sourceTitle: 'MedlinePlus Genetics · Mitochondrial DNA', sourceURL: 'https://medlineplus.gov/genetics/chromosome/mitochondrial-dna/' },
  { id: 'neptune-discovery', category: 'Space', title: 'Neptune was predicted before it was seen', body: 'Astronomers used unexpected changes in Uranus’s orbit to calculate where an unseen planet might be. Neptune was then identified by telescope in 1846 near the predicted position.', sourceTitle: 'NASA · Neptune facts', sourceURL: 'https://science.nasa.gov/neptune/facts/' },
  { id: 'earth-not-sphere', category: 'Earth', title: 'Earth is slightly squashed', body: 'Earth bulges around the equator because it rotates. Its equatorial diameter is about 43 kilometres greater than its polar diameter.', sourceTitle: 'NOAA · Is Earth round?', sourceURL: 'https://oceanservice.noaa.gov/facts/earth-round.html' },
  { id: 'corona-hotter', category: 'Space', title: 'The Sun’s outer atmosphere is hotter than its surface', body: 'The Sun’s visible surface is about 5,500°C, but its corona can reach over a million degrees. Scientists study how magnetic processes transfer energy into that outer atmosphere.', sourceTitle: 'NASA · The Sun’s corona', sourceURL: 'https://science.nasa.gov/sun/' },
  { id: 'antarctic-ice', category: 'Earth', title: 'Antarctica stores most of our fresh water as ice', body: 'More than half of the world’s fresh water is locked in Antarctica’s ice sheet. Water frozen into ice still counts as fresh water, even though it is not readily available to drink.', sourceTitle: 'British Antarctic Survey · Ice sheets', sourceURL: 'https://www.bas.ac.uk/about/antarctica/geography/ice/' },
]);

export function factOfDay(date, options = {}) {
  const timezone = options.timezone || 'Europe/Amsterdam';
  const value = date || new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(options.now || new Date());
  if (!isDate(value)) throw new Error('Fact date must be a valid YYYY-MM-DD.');
  const index = ((Math.floor(Date.parse(`${value}T00:00:00Z`) / DAY) % FACTS.length) + FACTS.length) % FACTS.length;
  return { ...FACTS[index], text: FACTS[index].body, source: FACTS[index].sourceTitle, date: value, favorite: (options.favorites || []).includes(FACTS[index].id) };
}

export function toggleFactFavorite(stateOrFavorites = [], id) {
  const isState = object(stateOrFavorites);
  const favorites = isState ? stateOrFavorites.favorites : stateOrFavorites;
  if (!FACTS.some(fact => fact.id === id)) throw new Error('Unknown fact.');
  const next = favorites.includes(id) ? favorites.filter(value => value !== id) : [...new Set([...favorites, id])];
  return isState ? { ...stateOrFavorites, favorites: next } : next;
}
