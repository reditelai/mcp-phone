// Tests of the tool limits during a call (src/conversation.ts): the owner waits in silence while a tool runs.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { limitForCall } from '../dist/conversation.js';

const mg = (name) => `mcp__multi-gmail__${name}`;

test('a search stays in one mailbox and short', () => {
  assert.ok('refuse' in limitForCall(mg('mg_search_threads'), { account: 'all', query: 'x' }));
  assert.equal(limitForCall(mg('mg_search_threads'), { account: 'prace', query: 'x', max_results: 25 }).input.max_results, 3);
  assert.equal(limitForCall(mg('mg_search_threads'), { account: 'prace', query: 'x' }).input.max_results, 3);
  assert.equal(limitForCall(mg('mg_search_threads'), { account: 'prace', query: 'x', max_results: 1 }).input.max_results, 1);
});

test('one message, short; no whole threads', () => {
  assert.equal(limitForCall(mg('mg_get_message'), { account: 'prace', message_id: 'a' }).input.max_body_length, 3000);
  assert.ok('refuse' in limitForCall(mg('mg_get_thread'), { account: 'prace', thread_id: 't' }));
  assert.equal(limitForCall(mg('mg_list_accounts'), { verify: true }).input.verify, false);
});

test('nothing is written during a call, whatever the settings allow', () => {
  for (const name of ['mg_save_draft', 'mg_send_message', 'mg_trash_message', 'mg_set_flags', 'mg_label_thread']) {
    assert.ok('refuse' in limitForCall(mg(name), { account: 'prace' }), name);
  }
});

test('other tools pass unchanged', () => {
  assert.deepEqual(limitForCall('mcp__phone_call__hang_up', {}), { input: {} });
});
