// Tests of when a call may end (src/conversation.ts): never in silence, never right after a question.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hangUpRefusal, PendingHangUp } from '../dist/conversation.js';

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

test('a hang-up waits until the goodbye has been spoken', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let ended = 0;
  const hangUp = new PendingHangUp(() => ended++);
  hangUp.request();
  hangUp.schedule(2000);
  t.mock.timers.tick(1999);
  assert.equal(ended, 0);
  t.mock.timers.tick(1);
  assert.equal(ended, 1);
  assert.equal(hangUp.cancel(), false, 'too late to call it off');
});

test('the caller speaking before the goodbye is over calls the hang-up off', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let ended = 0;
  const hangUp = new PendingHangUp(() => ended++);
  // Cut in while the turn is still running, before it was scheduled.
  hangUp.request();
  assert.equal(hangUp.cancel(), true);
  hangUp.schedule(2000);
  t.mock.timers.tick(5000);
  assert.equal(ended, 0);
  // Cut in while the goodbye is being spoken.
  hangUp.request();
  hangUp.schedule(2000);
  t.mock.timers.tick(1000);
  assert.equal(hangUp.cancel(), true);
  assert.equal(hangUp.requested, false);
  t.mock.timers.tick(5000);
  assert.equal(ended, 0);
  assert.equal(hangUp.cancel(), false, 'nothing left to call off');
});
