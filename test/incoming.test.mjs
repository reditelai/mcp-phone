// Tests of the conditions for incoming calls (src/incoming.ts): a half-done setup must say what is missing.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { incomingBase, incomingProblems, voicemailTwiml } from '../dist/incoming.js';

const config = (conversation, incoming) => ({
  settings: {
    voice: 'ElevenLabs.x', language: 'cs-CZ',
    conversation: { tunnel: 'none', ...conversation },
    incoming: { enabled: true, voicemail_text: 'Nechte prosím vzkaz.', ...incoming },
  },
});

test('incoming calls need a fixed address, a secret and a greeting', () => {
  assert.equal(incomingProblems(config({}, {})).length, 3);
  assert.ok(incomingProblems(config({ public_url: 'https://t.example', tunnel: 'quick' }, { path_secret: 'x'.repeat(24), greeting: 'Dobrý den, AI asistentka.' })).some((p) => p.includes('quick')));
  assert.deepEqual(incomingProblems(config({ public_url: 'https://t.example' }, { path_secret: 'x'.repeat(24), greeting: 'Dobrý den, AI asistentka.' })), []);
});

test('the address of the service', () => {
  assert.equal(incomingBase(config({ public_url: 'https://t.example' }, { path_secret: 'abc' })), 'https://t.example/prichozi/abc');
  assert.equal(incomingBase(config({}, { path_secret: 'abc' })), null);
});

test('voicemail lets the caller leave a recording', () => {
  const xml = voicemailTwiml(config({}, {}));
  assert.match(xml, /<Record /);
  assert.match(xml, /Nechte prosím vzkaz/);
});
