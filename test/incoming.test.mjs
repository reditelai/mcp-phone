// Tests of the conditions for incoming calls (src/incoming.ts): a half-done setup must say what is missing.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { incomingBase, incomingProblems, voicemailTwiml } from '../dist/incoming.js';

const config = (conversation, incoming, secret) => ({
  keys: secret === undefined ? {} : { incoming_secret: secret },
  settings: {
    voice: 'ElevenLabs.x', language: 'cs-CZ',
    conversation: { tunnel: 'none', ...conversation },
    incoming: { enabled: true, voicemail_text: 'Nechte prosím vzkaz.', ...incoming },
  },
});

test('incoming calls need a fixed address, a secret and a greeting', () => {
  assert.equal(incomingProblems(config({}, {})).length, 3);
  assert.ok(incomingProblems(config({ public_url: 'https://t.example', tunnel: 'quick' }, { greeting: 'Dobrý den, AI asistentka.' }, 'x'.repeat(24))).some((p) => p.includes('quick')));
  assert.deepEqual(incomingProblems(config({ public_url: 'https://t.example' }, { greeting: 'Dobrý den, AI asistentka.' }, 'x'.repeat(24))), []);
});

test('the address of the service', () => {
  assert.equal(incomingBase(config({ public_url: 'https://t.example' }, {}, 'abc')), 'https://t.example/prichozi/abc');
  assert.equal(incomingBase(config({}, {}, 'abc')), null);
});

test('voicemail lets the caller leave a recording', () => {
  const xml = voicemailTwiml(config({}, {}));
  assert.match(xml, /<Record /);
  assert.match(xml, /Nechte prosím vzkaz/);
});

test('with owner_lines, only the owner\'s forwarded or direct calls reach the secretary', async () => {
  const { admitted, sameNumber } = await import('../dist/incoming.js');
  const c = (lines) => ({ settings: { incoming: { owner_lines: lines } } });
  const lines = ['+420777123456', '+420602123456'];
  assert.ok(sameNumber('+420777123456', '777123456'));
  assert.ok(!sameNumber('+420777123456', '+420602123456'));
  // without the setting: everybody, as before
  assert.ok(admitted(c(undefined), '+420777000111', ''));
  // 1. forwarded from the owner's line (Twilio may drop the country code)
  assert.ok(admitted(c(lines), '+420777000111', '777123456'));
  assert.ok(admitted(c(lines), '+420777000111', '+420602123456'));
  // 2. a direct call from the owner's line
  assert.ok(admitted(c(lines), '+420777123456', ''));
  // 3. anything else
  assert.ok(!admitted(c(lines), '+420777000111', ''));
  assert.ok(!admitted(c(lines), '+420777000111', '+420777000222'));
  assert.ok(!admitted(c(lines), '+420777123456', '+420777000222'));
});

test('the PIN: only the owner\'s numbers, exact digits, ten wrong tries a day switch it off', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { ownerLine, pinMatches, pinLocked, addPinFailure, PIN_FAILURES_PER_DAY } = await import('../dist/incoming.js');
  const dir = mkdtempSync(join(tmpdir(), 'pin-'));
  const c = {
    configPath: join(dir, 'phone.json'),
    settings: { owner: '+420777123456', timezone: 'Europe/Prague', conversation: {}, incoming: { owner_lines: ['+420602123456'], queue_file: 'fronta.jsonl' } },
  };
  assert.ok(ownerLine(c, '+420777123456'));
  assert.ok(ownerLine(c, '602123456'));
  assert.ok(!ownerLine(c, '+420777000111'));
  assert.ok(pinMatches('482915', '482915'));
  assert.ok(!pinMatches('482915', '48291'));
  assert.ok(!pinMatches('482915', '482916'));
  assert.ok(!pinLocked(c));
  for (let i = 1; i < PIN_FAILURES_PER_DAY; i++) assert.equal(addPinFailure(c), false);
  assert.equal(addPinFailure(c), true);
  assert.ok(pinLocked(c));
});
