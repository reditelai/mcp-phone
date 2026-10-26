// Tests of what the synthesizer gets and what the transcript keeps (src/conversation.ts, src/incoming.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { heardPart, pronounced, Pronouncer } from '../dist/conversation.js';
import { silentHangUp } from '../dist/incoming.js';

test('"AI" is said as a word in Czech, not spelled out', () => {
  assert.equal(pronounced('Jsem Věrka, Karlova AI asistentka.', 'cs-CZ'), 'Jsem Věrka, Karlova éjáj asistentka.');
  assert.equal(pronounced('AI.', 'cs-CZ'), 'éjáj.');
  // Only the word on its own.
  assert.equal(pronounced('AIDS, MAIL, Aida', 'cs-CZ'), 'AIDS, MAIL, Aida');
  // Other languages say it right already.
  assert.equal(pronounced('your AI assistant', 'en-US'), 'your AI assistant');
});

test('a word split between streamed pieces is still caught', () => {
  const voice = new Pronouncer('cs-CZ');
  const out = ['Jsem Karlova A', 'I asis', 'tentka', '.'].map((piece) => voice.push(piece)).join('') + voice.end();
  assert.equal(out, 'Jsem Karlova éjáj asistentka.');
});

test('nothing is held back at the end of an answer', () => {
  const voice = new Pronouncer('cs-CZ');
  assert.equal(voice.push('Na shledanou'), 'Na ');
  assert.equal(voice.end(), 'shledanou');
  assert.equal(voice.end(), '');
});

test('a dropped answer leaves nothing for the next one', () => {
  const voice = new Pronouncer('cs-CZ');
  voice.push('Děkuji, vyřídím');
  voice.drop();
  assert.equal(voice.push('Dobře.') + voice.end(), 'Dobře.');
});

test('what was heard of a cut answer counts from its start', () => {
  const said = 'Děkuji. Potřebuji ještě jméno, aby Karel věděl, komu má zavolat.';
  // Twilio gave only the last stretch.
  assert.equal(heardPart(said, 'aby Karel věděl, komu'), 'Děkuji. Potřebuji ještě jméno, aby Karel věděl, komu');
  // Or the whole of it.
  assert.equal(heardPart(said, 'Děkuji. Potřebuji'), 'Děkuji. Potřebuji');
  // Nothing heard, or a stretch not found in the text: as given.
  assert.equal(heardPart(said, '  '), '');
  assert.equal(heardPart(said, 'něco jiného'), 'něco jiného');
});

test('a caller who left without a word: during the greeting or after it', () => {
  const greeting = 'Dobrý den, tady Věrka, Karlova éjáj asistentka. Co mu mám vyřídit?'; // about 5 s
  const at = 1_000_000;
  assert.match(silentHangUp('caller', [], at, greeting, at + 2_000), /během pozdravu \(po 2 s/);
  assert.match(silentHangUp('caller', [], at, greeting, at + 12_000), /zavěsil 7 s po pozdravu/);
  // Someone who spoke, a call the secretary ended, or one that never connected: nothing to add.
  assert.equal(silentHangUp('caller', [{ who: 'callee', text: 'Haló?' }], at, greeting, at + 3_000), null);
  assert.equal(silentHangUp('assistant', [], at, greeting, at + 3_000), null);
  assert.equal(silentHangUp('caller', [], undefined, greeting, at + 3_000), null);
});
