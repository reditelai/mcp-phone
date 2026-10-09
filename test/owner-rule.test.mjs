// Tests of when the assistant may call the owner on her own (src/rules.ts): his setting, not a built-in rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ownerRule } from '../dist/rules.js';

test('without the setting she calls only when asked', () => {
  assert.match(ownerRule({}), /only when he asks/);
  assert.match(ownerRule({ call_owner_when: [] }), /only when he asks/);
});

test('with the setting she gets the owner\'s own cases', () => {
  const rule = ownerRule({ call_owner_when: ['když napíše kdokoli od Nováků', 'faktura nad 50 000'] });
  assert.match(rule, /"když napíše kdokoli od Nováků"; "faktura nad 50 000"/);
  assert.doesNotMatch(rule, /only when he asks/);
});
