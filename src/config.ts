// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

/**
 * Settings and keys.
 *
 * Two files, like Multigmail: the settings (`system/phone.json` in Miládka)
 * hold no secret and are backed up with her folder; the Twilio keys live in
 * the passwords file (`.miladka/secrets/phone/hesla.json`), which is never
 * backed up and never read by the assistant. Someone who loses the computer
 * types in only the keys again.
 *
 * Errors here are read by a person in the log when the server does not start,
 * so they are in Czech.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import * as z from 'zod';

import { ConfigError } from './errors.js';
import { vaultPasswordsPath, vaultRoot } from './location.js';

/** A phone number in the international format Twilio needs: plus, country code, digits. */
const E164 = /^\+[1-9]\d{7,14}$/;
const phoneNumber = z.string().regex(E164, 'číslo musí být v mezinárodním tvaru bez mezer, například +420777123456');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'čas ve tvaru HH:MM, například 22:00');

/** The name the owner goes by in tel_call. A recipient may not take it. */
export const OWNER = 'owner';

const settingsSchema = z
  .object({
    // The owner is the only one Miládka calls on her own, the only one she may
    // tell anything from the notes and mail, and the only one an urgent call
    // reaches during quiet hours (Karel, 7. 10. 2026).
    owner: phoneNumber,
    // Others she may call, only when the owner asks and only with the text he
    // gives. Empty means nobody, not anybody.
    recipients: z.record(z.string().min(1), phoneNumber).default({}),
    // A number that is in neither list, on the owner's word in the chat. Every
    // such call needs the owner's click: the tool is marked as requiring user
    // interaction, which Claude Code honours in every permission mode.
    call_other_numbers: z.boolean().default(false),
    from: phoneNumber,
    voice: z.string().min(1).default('ElevenLabs.bF7C2fCv7Zf30iT84wZ1'),
    language: z.string().min(2).default('cs-CZ'),
    quiet_hours: z.object({ from: clock, to: clock }).nullable().default({ from: '22:00', to: '07:00' }),
    quiet_hours_mode: z.enum(['never', 'urgent_only']).default('never'),
    timezone: z.string().min(1).default('Europe/Prague'),
    daily_limit: z.number().int().min(1).max(100).default(10),
    max_message_length: z.number().int().min(20).max(3000).default(500),
    // Where the Twilio keys are. Relative to Miládka's folder when the server
    // runs from it, else to the settings file.
    passwords_file: z.string().min(1).optional(),
  })
  .strict();

export type Settings = z.infer<typeof settingsSchema>;

const keysSchema = z
  .object({
    account_sid: z.string().regex(/^AC[0-9a-f]{32}$/, 'Account SID začíná AC a má 34 znaků'),
    api_key: z.string().regex(/^SK[0-9a-f]{32}$/, 'SID API klíče začíná SK a má 34 znaků'),
    api_secret: z.string().min(16, 'Secret API klíče je kratší, než by měl být'),
  })
  .strict();

export type Keys = z.infer<typeof keysSchema>;

export interface Config {
  settings: Settings;
  keys: Keys;
  configPath: string;
}

function describe(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || '(soubor)'}: ${issue.message}`).join('; ');
}

async function readJson(path: string, what: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new ConfigError(`${what} nejde přečíst: ${path}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ConfigError(`${what} není platný JSON: ${path}`);
  }
}

/**
 * Keys from the environment win over the file, so a developer can run the
 * server without a passwords file. All three or none: a mix would be a key
 * from one account and a secret from another.
 */
function keysFromEnv(): Keys | null {
  const account_sid = process.env['TWILIO_ACCOUNT_SID'];
  const api_key = process.env['TWILIO_API_KEY'];
  const api_secret = process.env['TWILIO_API_SECRET'];
  if (account_sid === undefined && api_key === undefined && api_secret === undefined) return null;
  const parsed = keysSchema.safeParse({ account_sid, api_key, api_secret });
  if (!parsed.success) throw new ConfigError(`Klíče Twilia v proměnných prostředí: ${describe(parsed.error)}`);
  return parsed.data;
}

export async function loadConfig(configPath: string): Promise<Config> {
  const parsed = settingsSchema.safeParse(await readJson(configPath, 'Nastavení'));
  if (!parsed.success) throw new ConfigError(`Nastavení ${configPath}: ${describe(parsed.error)}`);
  const settings = parsed.data;

  if (OWNER in settings.recipients) {
    throw new ConfigError(`Nastavení ${configPath}: "${OWNER}" je jméno majitele, v recipients ho použij pro někoho jiného pod jiným jménem.`);
  }
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone });
  } catch {
    throw new ConfigError(`Nastavení ${configPath}: neznámé časové pásmo "${settings.timezone}", například Europe/Prague.`);
  }

  let keys = keysFromEnv();
  if (keys === null) {
    const passwordsPath =
      settings.passwords_file !== undefined
        ? resolve(vaultRoot() ?? dirname(configPath), settings.passwords_file)
        : vaultPasswordsPath();
    if (passwordsPath === null) {
      throw new ConfigError(
        'Chybí klíče Twilia: mimo složku Miládky je zadej v "passwords_file" nebo v proměnných TWILIO_ACCOUNT_SID, TWILIO_API_KEY a TWILIO_API_SECRET.',
      );
    }
    const parsedKeys = keysSchema.safeParse(await readJson(passwordsPath, 'Soubor s klíči Twilia'));
    // Never quote the file: it holds the secret.
    if (!parsedKeys.success) throw new ConfigError(`Soubor s klíči Twilia ${passwordsPath}: ${describe(parsedKeys.error)}`);
    keys = parsedKeys.data;
  }

  return { settings, keys, configPath };
}
