// docs/nastaveni.md describes every setting and its default: checked against the program,
// so the description and the code cannot drift apart (Karel, 12. 10. 2026).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { conversationSchema, incomingSchema, keysSchema, settingsSchema } from '../dist/config.js';

const doc = readFileSync(new URL('../docs/nastaveni.md', import.meta.url), 'utf8');
const rows = new Map([...doc.matchAll(/^\| `([a-z_.]+)` \| (.+?) \|/gm)].map((m) => [m[1], m[2]]));

const defaults = settingsSchema.parse({ owner: '+420777123456', from: '+420777123457' });
const keys = [
  ...Object.keys(settingsSchema.shape).filter((k) => k !== 'conversation' && k !== 'incoming'),
  ...Object.keys(conversationSchema.shape).map((k) => `conversation.${k}`),
  ...Object.keys(incomingSchema.shape).map((k) => `incoming.${k}`),
];
const required = new Set(['owner', 'from', 'account_sid', 'api_key', 'api_secret']);

test('every setting is described, with the default the program uses', () => {
  for (const key of keys) {
    const cell = rows.get(key);
    assert.ok(cell !== undefined, `docs/nastaveni.md: chybí řádek pro ${key}`);
    const value = key.split('.').reduce((o, k) => o?.[k], defaults);
    if (required.has(key)) assert.equal(cell, 'povinné', key);
    else if (value === undefined) assert.equal(cell, 'nenastaveno', key);
    else if (typeof value === 'string' && value.length > 120) assert.match(cell, /vestavěné/, key);
    else assert.ok(cell.includes(`\`${JSON.stringify(value)}\``), `${key}: v dokumentaci „${cell}", v programu ${JSON.stringify(value)}`);
  }
});

test('every key file entry is described', () => {
  for (const key of Object.keys(keysSchema.shape)) {
    const cell = rows.get(key);
    assert.ok(cell !== undefined, `docs/nastaveni.md: chybí řádek pro klíč ${key}`);
    assert.equal(cell, required.has(key) ? 'povinné' : 'nenastaveno', key);
  }
});

test('the description has no setting the program does not know', () => {
  const known = new Set([...keys, ...Object.keys(keysSchema.shape)]);
  for (const key of rows.keys()) assert.ok(known.has(key), `docs/nastaveni.md popisuje ${key}, program ho nezná`);
});
