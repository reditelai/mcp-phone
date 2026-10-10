// Tests of when a call may end (src/conversation.ts): never in silence, never right after a question.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hangUpRefusal } from '../dist/conversation.js';

test('no hang-up before anything was said', () => {
  assert.match(hangUpRefusal(''), /not said anything/);
  assert.match(hangUpRefusal('   '), /not said anything/);
});

test('no hang-up right after a question', () => {
  assert.match(hangUpRefusal('Je to všechno?'), /question/);
});

test('a goodbye may end the call', () => {
  assert.equal(hangUpRefusal('Vyřídím Karlovi, že data jsou na úložišti a schůzka je ve čtvrtek ve 14:30. Na shledanou.'), null);
});

test('no hang-up while the caller is still speaking or did not hear the answer', () => {
  const goodbye = 'Vyřídím Karlovi, že data jsou na úložišti. Na shledanou.';
  assert.match(hangUpRefusal(goodbye, { callerSpoke: true }), /still speaking/);
  assert.match(hangUpRefusal(goodbye, { cutOff: true }), /did not hear/);
  assert.equal(hangUpRefusal(goodbye, { callerSpoke: false, cutOff: false }), null);
});
