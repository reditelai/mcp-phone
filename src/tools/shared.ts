// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

import type { Config } from '../config.js';
import { ToolError } from '../errors.js';
import { checkMessage, checkQuietHours, startOfToday } from '../rules.js';
import { countCallsSince, explain, FINAL, fetchCall, placeCall, type CallInfo } from '../twilio.js';

/**
 * Declared as a type alias rather than an interface on purpose: the SDK's
 * result type carries an index signature, and TypeScript grants an implicit
 * one to type aliases but not to interfaces.
 */
export type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export function asJson(payload: unknown): ToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

/** Run a tool and report a failure as a failure, with a code and a sentence. */
export async function runTool(work: () => Promise<ToolResponse>): Promise<ToolResponse> {
  try {
    return await work();
  } catch (error) {
    const payload =
      error instanceof ToolError
        ? { error: { code: error.code, message: error.message } }
        : { error: { code: 'internal_error', message: error instanceof Error ? error.message : String(error) } };
    return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: true };
  }
}

/** How long a call is followed before the tool returns. Ringing plus a 500-character message fit. */
const WAIT_MS = 120_000;
const POLL_MS = 4_000;

/**
 * Quiet hours and the daily limit: checked before anything reaches Twilio.
 * Every attempt counts, answered or not: an unanswered call disturbs too, and
 * the limit is there so that nobody gets called over and over (Karel, 8. 10.
 * 2026). Returns how many calls are left today after this one.
 */
export async function preflight(config: Config, toOwner: boolean, urgent: boolean): Promise<number> {
  const { settings, keys } = config;
  checkQuietHours(settings, toOwner, urgent);
  const today = await countCallsSince(keys, settings, startOfToday(settings.timezone));
  if (today >= settings.daily_limit) {
    throw new ToolError(
      'daily_limit',
      `${today} calls have gone out today and the daily limit is ${settings.daily_limit}. No more calls today; use another channel.`,
    );
  }
  return settings.daily_limit - today - 1;
}

/**
 * Every check, then the call, then waiting for how it ended. The order matters:
 * nothing reaches Twilio before all the limits have passed.
 */
export async function call(config: Config, to: string, toOwner: boolean, message: string, urgent: boolean, wait: boolean): Promise<CallInfo & { meaning: string; calls_left_today: number }> {
  const { settings, keys } = config;
  const text = checkMessage(settings, message);
  const left = await preflight(config, toOwner, urgent);

  let info = await placeCall(keys, settings, to, text);
  if (wait) {
    const deadline = Date.now() + WAIT_MS;
    while (!FINAL.has(info.status) && Date.now() < deadline) {
      await new Promise((done) => setTimeout(done, POLL_MS));
      info = await fetchCall(keys, info.sid);
    }
  }
  return { ...info, meaning: explain(info), calls_left_today: left };
}
