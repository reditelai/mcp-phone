// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

/**
 * The three Twilio calls this server needs, over plain HTTPS: place a call,
 * look one up, list today's calls. No SDK - three requests do not need one,
 * and every dependency is one more thing in the bundled file.
 *
 * Authenticated with an API key (SK…), not the account's Auth Token: a key can
 * be revoked on its own without touching the account.
 */

import type { Keys, Settings } from './config.js';
import { ToolError } from './errors.js';

const API = 'https://api.twilio.com/2010-04-01';

export interface CallInfo {
  sid: string;
  status: string;
  duration_seconds: number | null;
  started: string | null;
  /**
   * For a call nobody answered (busy, no-answer): roughly how long it rang,
   * from Twilio's start and end time. A few seconds means busy or switched
   * off at once; longer means it rang and was declined or left (Karel,
   * 9. 10. 2026: "jestli to hned hlásilo obsazeno, nebo zvonilo").
   */
  ring_seconds: number | null;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function sayTwiml(settings: Settings, message: string): string {
  return `<Response><Say voice="${escapeXml(settings.voice)}" language="${escapeXml(settings.language)}">${escapeXml(message)}</Say></Response>`;
}

async function request(keys: Keys, method: 'GET' | 'POST' | 'DELETE', path: string, form?: Record<string, string>): Promise<Record<string, unknown>> {
  const auth = 'Basic ' + Buffer.from(`${keys.api_key}:${keys.api_secret}`).toString('base64');
  let response: Response;
  try {
    response = await fetch(`${API}/Accounts/${keys.account_sid}${path}`, {
      method,
      headers: { Authorization: auth, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      body: form ? new URLSearchParams(form) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new ToolError('twilio_unreachable', `Twilio did not answer: ${error instanceof Error ? error.message : String(error)}`);
  }
  const body = (response.status === 204 ? {} : await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof body['code'] === 'number' ? body['code'] : response.status;
    const message = typeof body['message'] === 'string' ? body['message'] : `HTTP ${response.status}`;
    // 21215: the destination country is not allowed in Voice Geographic Permissions.
    const hint = code === 21215 ? ' The owner has to allow calls to that country in the Twilio console (Voice Geographic Permissions).' : '';
    throw new ToolError(response.status === 401 ? 'twilio_auth' : 'twilio_error', `Twilio refused (code ${code}): ${message}.${hint}`);
  }
  return body;
}

function time(value: unknown): number | null {
  if (typeof value !== 'string' || value === '') return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function toCallInfo(body: Record<string, unknown>): CallInfo {
  const duration = typeof body['duration'] === 'string' ? Number(body['duration']) : null;
  const status = String(body['status'] ?? 'unknown');
  const start = time(body['start_time']) ?? time(body['date_created']);
  const end = time(body['end_time']) ?? (FINAL.has(status) ? time(body['date_updated']) : null);
  const unanswered = status === 'busy' || status === 'no-answer';
  return {
    sid: String(body['sid'] ?? ''),
    status,
    duration_seconds: duration !== null && Number.isFinite(duration) ? duration : null,
    started: typeof body['start_time'] === 'string' ? new Date(body['start_time']).toISOString() : null,
    ring_seconds: unanswered && start !== null && end !== null && end >= start ? Math.round((end - start) / 1000) : null,
  };
}

export async function placeCall(keys: Keys, settings: Settings, to: string, message: string): Promise<CallInfo> {
  return placeTwimlCall(keys, settings, to, sayTwiml(settings, message));
}

/** A call with any TwiML; timeLimit (seconds) makes Twilio hang up on its own. */
export async function placeTwimlCall(keys: Keys, settings: Settings, to: string, twiml: string, timeLimit?: number): Promise<CallInfo> {
  const form: Record<string, string> = { To: to, From: settings.from, Twiml: twiml };
  if (timeLimit !== undefined) form['TimeLimit'] = String(timeLimit);
  return toCallInfo(await request(keys, 'POST', '/Calls.json', form));
}

export async function fetchCall(keys: Keys, sid: string): Promise<CallInfo> {
  if (!/^CA[0-9a-f]{32}$/.test(sid)) throw new ToolError('call_unknown', 'A call id starts with CA and has 34 characters.');
  return toCallInfo(await request(keys, 'GET', `/Calls/${sid}.json`));
}

/**
 * How many calls left the owner's Twilio number since the given instant.
 * Counted from Twilio's own records rather than kept here, so the server has
 * no state to lose, and a restart does not reset the daily limit.
 */
export async function countCallsSince(keys: Keys, settings: Settings, since: Date): Promise<number> {
  // Twilio filters by UTC date only; take the day before as well and filter precisely here.
  const day = new Date(since.getTime() - 86_400_000).toISOString().slice(0, 10);
  const query = new URLSearchParams({ From: settings.from, 'StartTime>': day, PageSize: '200' });
  const body = await request(keys, 'GET', `/Calls.json?${query.toString()}`);
  const calls = Array.isArray(body['calls']) ? (body['calls'] as Array<Record<string, unknown>>) : [];
  return calls.filter((call) => {
    const created = typeof call['date_created'] === 'string' ? new Date(call['date_created']) : null;
    return created !== null && created.getTime() >= since.getTime();
  }).length;
}

/** Statuses after which nothing changes any more. */
export const FINAL = new Set(['completed', 'busy', 'no-answer', 'failed', 'canceled']);

/** What a status means for the assistant, in a sentence. */
export function explain(info: CallInfo): string {
  switch (info.status) {
    case 'completed':
      return `Answered; the call lasted ${info.duration_seconds ?? '?'} s. A call that lasted about as long as the message took was most likely heard in full; a much shorter one may have been hung up early. Twilio cannot tell a person from voicemail.`;
    case 'busy':
      return info.ring_seconds !== null && info.ring_seconds >= 5
        ? `It rang for about ${info.ring_seconds} s and was declined. Nothing was played.`
        : 'Busy at once (line busy, phone off or call rejected immediately). Nothing was played.';
    case 'no-answer':
      return 'Nobody picked up. Nothing was played.';
    case 'failed':
      return 'The call could not be placed. Nothing was played.';
    case 'canceled':
      return 'Cancelled before it was answered.';
    case 'queued':
    case 'initiated':
      return 'Being dialled.';
    case 'ringing':
      return 'Ringing.';
    case 'in-progress':
      return 'Answered, the message is being read.';
    default:
      return `Status ${info.status}.`;
  }
}

/** The owner's Twilio number as Twilio has it set up: where it sends incoming calls. */
export interface NumberSetup {
  sid: string;
  voice_url: string;
  voice_fallback_url: string;
  status_callback: string;
}

export async function findNumber(keys: Keys, settings: Settings): Promise<NumberSetup> {
  const query = new URLSearchParams({ PhoneNumber: settings.from });
  const body = await request(keys, 'GET', `/IncomingPhoneNumbers.json?${query.toString()}`);
  const found = Array.isArray(body['incoming_phone_numbers']) ? (body['incoming_phone_numbers'] as Array<Record<string, unknown>>)[0] : undefined;
  if (found === undefined) throw new ToolError('number_unknown', `The number ${settings.from} (settings "from") is not in this Twilio account.`);
  return {
    sid: String(found['sid'] ?? ''),
    voice_url: String(found['voice_url'] ?? ''),
    voice_fallback_url: String(found['voice_fallback_url'] ?? ''),
    status_callback: String(found['status_callback'] ?? ''),
  };
}

/**
 * Points incoming calls on the owner's number to the service, and the end of
 * every call to its status address, so a call closes even when its TwiML failed.
 */
export async function setVoiceUrl(keys: Keys, numberSid: string, url: string, statusUrl: string): Promise<void> {
  await request(keys, 'POST', `/IncomingPhoneNumbers/${numberSid}.json`, {
    VoiceUrl: url,
    VoiceMethod: 'POST',
    StatusCallback: statusUrl,
    StatusCallbackMethod: 'POST',
  });
}

/** What the account has left, as Twilio states it. */
export async function accountBalance(keys: Keys): Promise<{ balance: number; currency: string }> {
  const body = await request(keys, 'GET', '/Balance.json');
  return { balance: Number(body['balance'] ?? NaN), currency: String(body['currency'] ?? '') };
}

/** One line of a day's bill: a category of use and what it cost. */
export interface UsageLine {
  category: string;
  description: string;
  price: number;
  unit: string;
}

/** What one day cost, by category (calls, ConversationRelay, the number...), only lines with a price. */
export async function usageOn(keys: Keys, day: string): Promise<UsageLine[]> {
  const query = new URLSearchParams({ StartDate: day, EndDate: day, PageSize: '200' });
  const body = await request(keys, 'GET', `/Usage/Records/Daily.json?${query.toString()}`);
  const list = Array.isArray(body['usage_records']) ? (body['usage_records'] as Array<Record<string, unknown>>) : [];
  return list
    .map((r) => ({
      category: String(r['category'] ?? ''),
      description: String(r['description'] ?? r['category'] ?? ''),
      price: Number(r['price'] ?? 0) || 0,
      unit: String(r['price_unit'] ?? ''),
    }))
    // totalprice repeats the sum of the rest.
    .filter((line) => line.price !== 0 && line.category !== 'totalprice');
}

export interface Recording {
  sid: string;
  call_sid: string;
  created: string;
  duration_seconds: number;
}

/** Recordings left on the account, newest first (voicemail while the service was off). */
export async function listRecordings(keys: Keys): Promise<Recording[]> {
  const body = await request(keys, 'GET', '/Recordings.json?PageSize=50');
  const list = Array.isArray(body['recordings']) ? (body['recordings'] as Array<Record<string, unknown>>) : [];
  return list.map((r) => ({
    sid: String(r['sid'] ?? ''),
    call_sid: String(r['call_sid'] ?? ''),
    created: typeof r['date_created'] === 'string' ? new Date(r['date_created']).toISOString() : new Date().toISOString(),
    duration_seconds: Number(r['duration'] ?? 0) || 0,
  }));
}

/** Who called and to which number, for a call we did not place. */
export async function callParties(keys: Keys, sid: string): Promise<{ from: string; to: string; forwarded_from: string }> {
  const body = await request(keys, 'GET', `/Calls/${sid}.json`);
  return { from: String(body['from'] ?? ''), to: String(body['to'] ?? ''), forwarded_from: String(body['forwarded_from'] ?? '') };
}

export async function downloadRecording(keys: Keys, sid: string): Promise<Buffer> {
  const auth = 'Basic ' + Buffer.from(`${keys.api_key}:${keys.api_secret}`).toString('base64');
  const response = await fetch(`${API}/Accounts/${keys.account_sid}/Recordings/${sid}.mp3`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new ToolError('twilio_error', `Twilio did not return recording ${sid} (HTTP ${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

/** Once saved with the owner, the recording leaves Twilio: a voice message is personal data. */
export async function deleteRecording(keys: Keys, sid: string): Promise<void> {
  await request(keys, 'DELETE', `/Recordings/${sid}.json`);
}
