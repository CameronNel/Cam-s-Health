import test from 'node:test';
import assert from 'node:assert/strict';
import {createGateway, discover, DECLARED_TOOLS, gmailTools} from '../artifact/src/gmail.js';

const fakeMcp = (calls, tools = DECLARED_TOOLS) => ({
  listTools: async () => ({servers: [{server: 'Gmail', authStatus: 'connected', tools: tools.map(name => ({name, description: ''}))}]}),
  callTool: async (server, tool, input) => { calls.push({server, tool, input}); return {payload: {ok: true, tool}}; }
});
const ready = {search: true, read: true, removeLabel: true, trash: true};

test('discovery requires the declared connector tools', async () => {
  const found = await discover(fakeMcp([]));
  assert.equal(found.state, 'ready');
  assert.deepEqual(found.tools, ready);
  assert.equal((await discover(fakeMcp([], ['search_threads']))).tools.read, false);
  assert.equal((await discover({listTools: async () => ({servers: []})})).state, 'server_not_connected');
});

test('gateway uses the connector schemas and only thread-level, recoverable changes', async () => {
  const calls = [], gw = createGateway(fakeMcp(calls), ready, new Map());
  await gw.search('in:inbox newer_than:7d', 500);
  await gw.read('t1');
  await gw.modify('t1', 'archive');
  await gw.modify('t2', 'read');
  await gw.modify('t3', 'trash');
  assert.deepEqual(calls.map(c => [c.tool, c.input]), [
    ['search_threads', {query: 'in:inbox newer_than:7d', pageSize: 50}],
    ['get_thread', {threadId: 't1', messageFormat: 'PLAIN_TEXT'}],
    ['unlabel_thread', {threadId: 't1', labelIds: ['INBOX']}],
    ['unlabel_thread', {threadId: 't2', labelIds: ['UNREAD']}],
    ['trash_thread', {threadId: 't3'}]
  ]);
  assert.ok(calls.every(c => DECLARED_TOOLS.includes(c.tool)), 'every call is inside the published manifest');
  assert.ok(!calls.some(c => /delete|send|forward|draft/.test(c.tool)), 'no permanent or outbound operation');
});

test('Claude-facing tools never expose label changes', () => {
  assert.deepEqual(gmailTools(createGateway(fakeMcp([]), ready, new Map())).map(t => t.name), ['gmail_search', 'gmail_read']);
});
