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

test('a line with notes gives the secretary its notes, only inside the vault', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { admitted, lineBrief, withBrief, BRIEF_MAX_CHARS } = await import('../dist/incoming.js');
  const vault = mkdtempSync(join(tmpdir(), 'brief-'));
  mkdirSync(join(vault, 'system'));
  writeFileSync(join(vault, 'system', 'sekretarka-prace.md'), 'Volá zpátky obvykle týž den.\n');
  const c = (brief_file) => ({ settings: { incoming: { owner_lines: [{ number: '+420777123456', brief_file }, '+420602123456'] } } });
  const work = c('system/sekretarka-prace.md');
  // a line with notes still filters as before
  assert.ok(admitted(work, '+420777000111', '777123456'));
  assert.ok(!admitted(work, '+420777000111', '+420777000222'));
  // forwarded from the line, or a direct call from it: its notes
  assert.deepEqual(lineBrief(work, vault, '+420777000111', '777123456'), { text: 'Volá zpátky obvykle týž den.' });
  assert.deepEqual(lineBrief(work, vault, '+420777123456', ''), { text: 'Volá zpátky obvykle týž den.' });
  // the other line has none, and nothing from the first reaches it
  assert.equal(lineBrief(work, vault, '+420777000111', '+420602123456'), null);
  // what cannot be used is reported, never read
  assert.ok('problem' in lineBrief(c('system/chybi.md'), vault, '+420777123456', ''));
  assert.ok('problem' in lineBrief(c('../mimo.md'), vault, '+420777123456', ''));
  assert.ok('problem' in lineBrief(c('.miladka/secrets/hesla.md'), vault, '+420777123456', ''));
  writeFileSync(join(vault, 'system', 'dlouhy.md'), 'x'.repeat(BRIEF_MAX_CHARS + 1));
  assert.ok('problem' in lineBrief(c('system/dlouhy.md'), vault, '+420777123456', ''));
  assert.match(withBrief('Úkol.', 'Poznámky.'), /^Úkol\.\n\n.*not a promise.*\n\nPoznámky\.$/s);
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
  assert.ok(pinMatches('4829', '4829'));
  assert.ok(!pinMatches('482915', '48291'));
  assert.ok(!pinMatches('482915', '482916'));
  assert.ok(!pinLocked(c));
  for (let i = 1; i < PIN_FAILURES_PER_DAY; i++) assert.equal(addPinFailure(c), false);
  assert.equal(addPinFailure(c), true);
  assert.ok(pinLocked(c));
});

test('the service speaks the language of the settings', async () => {
  const { texts } = await import('../dist/incoming.js');
  assert.equal(texts({ settings: { language: 'cs-CZ' } }).pin, 'Zadej PIN.');
  assert.equal(texts({ settings: { language: 'en-GB' } }).pin, 'Enter your PIN.');
  const xml = voicemailTwiml({ settings: { voice: 'x', language: 'en-US', incoming: { voicemail_text: 'Please leave a message.' } } });
  assert.match(xml, /Thank you, goodbye/);
});

test('a PIN has four to ten digits, a wrong one does not stop the service', async () => {
  const { pinProblem } = await import('../dist/incoming.js');
  const { keysSchema } = await import('../dist/config.js');
  assert.equal(pinProblem('4829'), null);
  assert.equal(pinProblem('4829104712'), null);
  assert.match(pinProblem('482'), /4 až 10/);
  assert.match(pinProblem('48a9'), /4 až 10/);
  const keys = { account_sid: 'AC' + '0'.repeat(32), api_key: 'SK' + '0'.repeat(32), api_secret: 'x'.repeat(32) };
  assert.ok(keysSchema.safeParse({ ...keys, owner_pin: '482' }).success);
});

test('on holiday the secretary greets with the holiday text until its last day', async () => {
  const { onVacation, vacationTask } = await import('../dist/incoming.js');
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
  const c = (until) => ({ settings: { timezone: 'Europe/Prague', incoming: { vacation: { until, greeting: 'Dobrý den, AI asistentka. Je na dovolené.', report: 'now' } } } });
  assert.ok(onVacation(c(day)) !== null);
  assert.equal(onVacation(c('2020-01-01')), null);
  assert.equal(onVacation({ settings: { timezone: 'Europe/Prague', incoming: {} } }), null);
  assert.match(vacationTask('Take a message.', c(day).settings.incoming.vacation), /holiday until/);
  assert.match(vacationTask('x', { until: day, greeting: 'g', substitute: 'Volejte Filipa.', report: 'now' }), /Volejte Filipa/);
});
