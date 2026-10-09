// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

/**
 * The limits the server enforces itself, not only through instructions to the
 * assistant. The assistant reads mail written by strangers; a limit that lives
 * only in its instructions can be talked out of it, one in here cannot.
 */

import type { Settings } from './config.js';
import { ToolError } from './errors.js';

/** Minutes since midnight in the given time zone. */
export function minutesNow(timezone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function toMinutes(clock: string): number {
  const [hour = '0', minute = '0'] = clock.split(':');
  return Number(hour) * 60 + Number(minute);
}

/** Whether now falls in the quiet hours. A window may cross midnight (22:00-07:00). */
export function inQuietHours(settings: Settings, now: Date = new Date()): boolean {
  if (settings.quiet_hours === null) return false;
  const from = toMinutes(settings.quiet_hours.from);
  const to = toMinutes(settings.quiet_hours.to);
  if (from === to) return false;
  const current = minutesNow(settings.timezone, now);
  return from < to ? current >= from && current < to : current >= from || current < to;
}

/**
 * Quiet hours: nobody is called, except the owner with an urgent call when
 * quiet_hours_mode allows it. Others are never woken up.
 */
export function checkQuietHours(settings: Settings, toOwner: boolean, urgent: boolean, now: Date = new Date()): void {
  if (!inQuietHours(settings, now)) return;
  const window = `${settings.quiet_hours?.from}-${settings.quiet_hours?.to} (${settings.timezone})`;
  if (toOwner && urgent && settings.quiet_hours_mode === 'urgent_only') return;
  if (toOwner && settings.quiet_hours_mode === 'urgent_only') {
    throw new ToolError(
      'quiet_hours',
      `It is quiet hours ${window}. Only an urgent call to the owner goes through now; this one is not marked urgent. Use another channel or wait.`,
    );
  }
  throw new ToolError('quiet_hours', `It is quiet hours ${window}: no calls now. Use another channel or wait until they end.`);
}

export function checkMessage(settings: Settings, message: string): string {
  const text = message.trim();
  if (text.length === 0) throw new ToolError('message_empty', 'The message is empty.');
  if (text.length > settings.max_message_length) {
    throw new ToolError(
      'message_too_long',
      `The message has ${text.length} characters; the limit is ${settings.max_message_length}. Say it shorter - a call is for the gist, details belong in writing.`,
    );
  }
  return text;
}

/** Local midnight of today in the given time zone, as an instant. */
export function startOfToday(timezone: string, now: Date = new Date()): Date {
  return new Date(now.getTime() - minutesNow(timezone, now) * 60_000 - now.getUTCSeconds() * 1000 - now.getUTCMilliseconds());
}

/**
 * When the assistant may call the owner on her own: only in the cases he set
 * (call_owner_when). An instruction, not a limit: the server cannot tell whether
 * the owner asked for a call. It goes into the server instructions, which the
 * assistant has in every conversation.
 */
export function ownerRule(settings: Settings): string {
  const cases = settings.call_owner_when ?? [];
  if (cases.length === 0) {
    return 'The owner has not set when you may call on your own, so call him only when he asks you to; otherwise write.';
  }
  return `Call the owner on your own only in the cases he set: ${cases.map((c) => `"${c}"`).join('; ')}. Anything else, write.`;
}
