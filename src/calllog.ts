// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

/**
 * The call log: one line for every call, so the owner knows afterwards what
 * was said to whom, also when Miládka phoned someone else (Karel, 8. 10.
 * 2026). It lives in system/ next to the transcripts and is backed up with
 * the vault. A failure to write it never fails the call.
 */

import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import type { Config } from './config.js';
import { conversationVaultDir } from './conversation.js';
import type { CallInfo } from './twilio.js';

function outcome(info: CallInfo): string {
  switch (info.status) {
    case 'completed':
      return `zvedl, ${info.duration_seconds ?? '?'} s`;
    case 'busy':
      return info.ring_seconds !== null && info.ring_seconds >= 5 ? `zvonilo asi ${info.ring_seconds} s, odmítl` : 'obsazeno hned';
    case 'no-answer':
      return info.ring_seconds !== null ? `zvonilo asi ${info.ring_seconds} s, nezvedl` : 'nezvedl';
    case 'failed':
      return 'nepodařilo se spojit';
    case 'canceled':
      return 'zrušeno';
    default:
      return `stav ${info.status} (hovor ještě běžel)`;
  }
}

export interface LogEntry {
  /** "majitel", a name from recipients, or the number dialled. */
  who: string;
  kind: 'vzkaz' | 'rozhovor';
  /** The message read out, for a one-way call. */
  message?: string;
  info: CallInfo;
  /** Transcript file of a conversation, relative to the vault. */
  transcript?: string | null;
}

export function logCall(config: Config, entry: LogEntry): void {
  const target = config.settings.call_log;
  if (target === null) return;
  try {
    const vault = conversationVaultDir(config);
    const file = resolve(vault, target);
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file)) appendFileSync(file, '# Hovory\n\nKaždý hovor Miládky, nejnovější dole.\n\n');
    const when = new Intl.DateTimeFormat('cs-CZ', { timeZone: config.settings.timezone, day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
      entry.info.started === null ? new Date() : new Date(entry.info.started),
    );
    let line = `- **${when}**, ${entry.kind}, komu: ${entry.who}, ${outcome(entry.info)}.`;
    if (entry.message !== undefined) line += ` „${entry.message.replace(/\s+/g, ' ').trim()}“`;
    if (entry.transcript) line += ` Přepis: [${entry.transcript.split('/').at(-1)}](${relative(dirname(file), resolve(vault, entry.transcript)).split('\\').join('/')})`;
    appendFileSync(file, `${line}\n`);
  } catch (error) {
    process.stderr.write(`mcp-phone: deník hovorů se nepodařilo zapsat: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}
