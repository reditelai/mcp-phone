// Tests of measuring the gaps from a two-channel recording (src/measure.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { gapLines, readWav, speech, splitChannels } from '../dist/measure.js';

const RATE = 8000;

/** A two-channel 16-bit WAV; each channel has a tone where the given stretches (in seconds) are. */
function wav(seconds, first, second) {
  const frames = seconds * RATE;
  const data = Buffer.alloc(frames * 4);
  const on = (stretches, t) => stretches.some(([a, b]) => t >= a && t < b);
  for (let i = 0; i < frames; i++) {
    const t = i / RATE;
    const tone = Math.round(4000 * Math.sin((2 * Math.PI * 300 * i) / RATE));
    const noise = Math.round((Math.random() - 0.5) * 40);
    data.writeInt16LE(on(first, t) ? tone : noise, i * 4);
    data.writeInt16LE(on(second, t) ? tone : noise, i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(2, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 4, 28);
  head.writeUInt16LE(4, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

test('a gap is split into Twilio, the model and the voice', () => {
  // Caller on the first channel, the secretary (greeting first) on the second.
  const file = wav(10, [[3, 5]], [[0, 2], [7, 8]]);
  const { rate, channels } = readWav(file);
  const sides = splitChannels(channels.map((c) => speech(c, rate)));
  assert.ok(sides);
  const events = [
    { kind: 'prompt', at: 6000 },
    { kind: 'word', at: 6500 },
  ];
  const lines = gapLines(sides.caller, sides.assistant, events, 0);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^měření: ticho 2,0 s od konce volajícího \(Twilio 1,0 s, model 0,5 s, hlas 0,5 s\)$/);
});

test('a pause inside one answer is not a gap', () => {
  const file = wav(10, [[2.5, 4]], [[0, 2], [5, 6], [6.6, 7.5]]);
  const { rate, channels } = readWav(file);
  const sides = splitChannels(channels.map((c) => speech(c, rate)));
  const lines = gapLines(sides.caller, sides.assistant, [], 0);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /ticho 1,0 s/);
});

test('a pause inside the caller\'s speech counts from its last part', () => {
  const file = wav(10, [[2.5, 3.5], [4, 5]], [[0, 2], [6, 7]]);
  const { rate, channels } = readWav(file);
  const sides = splitChannels(channels.map((c) => speech(c, rate)));
  const lines = gapLines(sides.caller, sides.assistant, [], 0);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /ticho 1,0 s/);
});
