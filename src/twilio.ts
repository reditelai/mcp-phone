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
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function sayTwiml(settings: Settings, message: string): string {
  return `<Response><Say voice="${escapeXml(settings.voice)}" language="${escapeXml(settings.language)}">${escapeXml(message)}</Say></Response>`;
}

async function request(keys: Keys, method: 'GET' | 'POST', path: string, form?: Record<string, string>): Promise<Record<string, unknown>> {
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
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof body['code'] === 'number' ? body['code'] : response.status;
    const message = typeof body['message'] === 'string' ? body['message'] : `HTTP ${response.status}`;
    // 21215: the destination country is not allowed in Voice Geographic Permissions.
    const hint = code === 21215 ? ' The owner has to allow calls to that country in the Twilio console (Voice Geographic Permissions).' : '';
    throw new ToolError(response.status === 401 ? 'twilio_auth' : 'twilio_error', `Twilio refused (code ${code}): ${message}.${hint}`);
  }
  return body;
}

function toCallInfo(body: Record<string, unknown>): CallInfo {
  const duration = typeof body['duration'] === 'string' ? Number(body['duration']) : null;
  return {
    sid: String(body['sid'] ?? ''),
    status: String(body['status'] ?? 'unknown'),
    duration_seconds: duration !== null && Number.isFinite(duration) ? duration : null,
    started: typeof body['start_time'] === 'string' ? new Date(body['start_time']).toISOString() : null,
  };
}

export async function placeCall(keys: Keys, settings: Settings, to: string, message: string): Promise<CallInfo> {
  return toCallInfo(await request(keys, 'POST', '/Calls.json', { To: to, From: settings.from, Twiml: sayTwiml(settings, message) }));
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
      return 'Busy or declined. Nothing was played.';
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
