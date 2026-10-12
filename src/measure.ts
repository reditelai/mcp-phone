// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

/**
 * Gaps the caller really hears, measured from a two-channel recording of the
 * call (incoming.measure_gaps, for tuning only). The timings in the
 * transcript start when Twilio hands over what the caller said; the caller
 * waits from the end of his own speech to the first sound of the answer.
 * Karel's stopwatch showed 4-5 s where the timings explained about 2.5 s
 * (12. 10. 2026), so the recording splits each gap into what Twilio, the
 * model and the voice take.
 */

/** One stretch of speech on one channel, in seconds from the start of the recording. */
export interface Segment {
  start: number;
  end: number;
}

/** When the server got the caller's words and when the answer's first word left, in ms since the epoch. */
export interface ServerEvent {
  kind: 'prompt' | 'word';
  at: number;
}

const FRAME_S = 0.02;
const MERGE_S = 0.25; // a shorter pause is still the same stretch of speech
const MIN_S = 0.12; // a shorter sound is a click, not speech

function decodeMuLaw(byte: number): number {
  const u = ~byte & 0xff;
  const t = (((u & 0x0f) << 3) + 0x84) << ((u & 0x70) >> 4);
  return u & 0x80 ? 0x84 - t : t - 0x84;
}

/** The samples of each channel of a WAV file (16-bit PCM or μ-law, as Twilio sends them). */
export function readWav(data: Buffer): { rate: number; channels: Float64Array[] } {
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let format = 0;
  let count = 0;
  let rate = 0;
  let bits = 0;
  let offset = 12;
  while (offset + 8 <= data.length) {
    const id = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      format = data.readUInt16LE(body);
      count = data.readUInt16LE(body + 2);
      rate = data.readUInt32LE(body + 4);
      bits = data.readUInt16LE(body + 14);
    } else if (id === 'data') {
      const pcm = format === 1 && bits === 16;
      const mulaw = format === 7 && bits === 8;
      if (!pcm && !mulaw) throw new Error(`unsupported WAV format ${format}/${bits} bit`);
      const width = pcm ? 2 : 1;
      const end = Math.min(body + size, data.length);
      const frames = Math.floor((end - body) / (width * count));
      const channels = Array.from({ length: count }, () => new Float64Array(frames));
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < count; c++) {
          const at = body + (i * count + c) * width;
          channels[c]![i] = pcm ? data.readInt16LE(at) : decodeMuLaw(data[at]!);
        }
      }
      return { rate, channels };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('WAV without data');
}

/** Stretches of speech in one channel: frames clearly louder than the line's own noise. */
export function speech(samples: Float64Array, rate: number): Segment[] {
  const size = Math.max(1, Math.round(rate * FRAME_S));
  const levels: number[] = [];
  for (let i = 0; i + size <= samples.length; i += size) {
    let sum = 0;
    for (let j = i; j < i + size; j++) sum += samples[j]! * samples[j]!;
    levels.push(Math.sqrt(sum / size));
  }
  const floor = [...levels].sort((a, b) => a - b)[Math.floor(levels.length * 0.2)] ?? 0;
  const threshold = Math.max(floor * 4, 300);
  const segments: Segment[] = [];
  levels.forEach((level, i) => {
    if (level < threshold) return;
    const start = i * FRAME_S;
    const last = segments.at(-1);
    if (last !== undefined && start - last.end <= MERGE_S) last.end = start + FRAME_S;
    else segments.push({ start, end: start + FRAME_S });
  });
  return segments.filter((s) => s.end - s.start >= MIN_S);
}

const fmt = (s: number): string => s.toFixed(1).replace('.', ',');

/**
 * One line per answer: from the end of the caller's speech to the first sound
 * of the answer, split by the server's own times. `startedAt` is when the
 * recording began by the server's clock (to a few tenths of a second).
 */
export function gapLines(caller: Segment[], assistant: Segment[], events: ServerEvent[], startedAt: number): string[] {
  const at = (ms: number): number => (ms - startedAt) / 1000;
  const prompts = events.filter((e) => e.kind === 'prompt').map((e) => at(e.at));
  const words = events.filter((e) => e.kind === 'word').map((e) => at(e.at));
  const lines: string[] = [];
  let previousEnd = assistant[0]?.end ?? 0; // the greeting
  for (const answer of assistant.slice(1)) {
    const spoke = caller.filter((s) => s.start >= previousEnd && s.start < answer.start);
    previousEnd = Math.max(previousEnd, answer.end);
    if (spoke.length === 0) continue; // a pause inside one answer
    const callerEnd = spoke.at(-1)!.end;
    const gap = answer.start - callerEnd;
    const prompt = prompts.filter((p) => p > callerEnd - 0.5 && p <= answer.start).at(-1);
    const word = prompt === undefined ? undefined : words.find((w) => w >= prompt && w <= answer.start + 0.5);
    const parts =
      prompt !== undefined && word !== undefined
        ? ` (Twilio ${fmt(prompt - callerEnd)} s, model ${fmt(word - prompt)} s, hlas ${fmt(answer.start - word)} s)`
        : '';
    lines.push(gap < 0 ? `měření: začala mluvit ${fmt(-gap)} s před koncem volajícího` : `měření: ticho ${fmt(gap)} s od konce volajícího${parts}`);
  }
  return lines;
}

/**
 * Which channel is the secretary: she speaks first (the greeting). Twilio
 * does not say which leg is on which channel of a relayed call.
 */
export function splitChannels(channels: Segment[][]): { caller: Segment[]; assistant: Segment[] } | null {
  if (channels.length !== 2) return null;
  const [a, b] = channels as [Segment[], Segment[]];
  const first = (s: Segment[]): number => s[0]?.start ?? Infinity;
  return first(a) <= first(b) ? { assistant: a, caller: b } : { assistant: b, caller: a };
}
