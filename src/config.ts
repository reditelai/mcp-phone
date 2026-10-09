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

/**
 * A two-way conversation (phase 2): Twilio converts speech to text and back,
 * a bridge in this server passes the text to a separate Claude session and
 * back. Off until the owner sets it up: it needs an address Twilio can reach.
 */
const conversationSchema = z
  .object({
    enabled: z.boolean().default(false),
    // The address Twilio connects to, e.g. https://telefon.example.com - a
    // reverse proxy with HTTPS in front of listen_host:listen_port. Without it,
    // tunnel "quick" opens a temporary Cloudflare tunnel for the length of a call.
    public_url: z.string().regex(/^https:\/\/[^/\s]+$/, 'adresa ve tvaru https://telefon.example.com, bez lomítka na konci').optional(),
    tunnel: z.enum(['none', 'quick']).default('none'),
    cloudflared_path: z.string().min(1).default('cloudflared'),
    // Where the bridge listens. Keep it off the public interface: the proxy or
    // the tunnel is the only way in.
    listen_host: z.string().min(1).default('127.0.0.1'),
    listen_port: z.number().int().min(1024).max(65535).default(8787),
    // The Claude Code executable the call session runs on. The SDK's own copy
    // is hundreds of megabytes per system, so the server uses the installed one.
    claude_path: z.string().min(1).default('claude'),
    model: z.string().min(1).default('sonnet'),
    greeting: z.string().min(1).default('Ahoj, tady Miládka. Poslouchám.'),
    max_minutes: z.number().int().min(1).max(60).default(10),
    // Folder the call session may read (the vault). Defaults to Miládka's folder.
    vault_dir: z.string().min(1).optional(),
    // Who Miládka is, read into the call session's instructions.
    persona_file: z.string().min(1).default('CLAUDE.md'),
    // Where the transcript of each call is written, relative to vault_dir. In
    // system/, so it is backed up with the vault (Karel, 8. 10. 2026).
    transcript_dir: z.string().min(1).default('system/hovory'),
    // Timings in the transcript: first word after a question, each tool, the
    // start of the session. For tuning; off by default (Karel, 8. 10. 2026).
    timings: z.boolean().default(false),
    vault_read: z.boolean().default(true),
    // Extra MCP servers for the call session (same shape as in .mcp.json) and
    // the tools from them it may use. Never the WhatsApp add-on: it holds one
    // live connection and a second session would knock it off.
    mcp_servers: z.record(z.string(), z.object({ command: z.string(), args: z.array(z.string()).default([]), env: z.record(z.string(), z.string()).optional() })).default({}),
    allowed_tools: z.array(z.string()).default([]),
    // The first sentence a call to anyone but the owner starts with, said
    // before the reason for the call. It has to say that an AI assistant is
    // calling and for whom, e.g. "Dobrý den, tady Miládka, AI asistentka
    // Karla Derfla." Without it, tel_converse_with stays off.
    others_introduction: z
      .string()
      .min(10)
      .max(200)
      .refine((text) => /\bAI\b/.test(text), 'představení musí říct, že volá AI asistentka (slovo „AI")')
      .optional(),
  })
  .strict();

const DEFAULT_INCOMING_TASK = [
  'Someone called the owner, who could not pick up, and the call came to you. Take a message.',
  'Find out who is calling (name, and company or town if they have one), what they need, whether it is urgent, and when and how the owner should get back to them.',
  'Do not say where the owner is or what he is doing, do not promise when he will call back, do not arrange anything. Only take the message and say you will pass it on.',
  'When you have it, repeat the main point in one sentence and say the owner will get the message. Then let the caller finish; when they have nothing more, say goodbye and hang up.',
].join(' ');

/**
 * Incoming calls (phase 2, server only): the owner forwards calls he does not
 * pick up to the Twilio number and an always-on service answers them as a
 * secretary that only takes a message (Karel, 9. 10. 2026). The session that
 * talks to the caller is the same isolated one as for calls to others.
 */
const incomingSchema = z
  .object({
    // Off = the caller hears voicemail_text and can leave a recording
    // (holidays, or while it is not set up).
    enabled: z.boolean().default(false),
    listen_port: z.number().int().min(1024).max(65535).default(8788),
    max_minutes: z.number().int().min(1).max(10).default(3),
    // What the caller hears first. It has to say that an AI assistant answers.
    greeting: z
      .string()
      .min(10)
      .max(300)
      .refine((text) => /\bAI\b/.test(text), 'pozdrav musí říct, že hovor bere AI asistentka (slovo „AI")')
      .optional(),
    task: z.string().min(20).max(4000).default(DEFAULT_INCOMING_TASK),
    voicemail_text: z.string().min(10).max(500).default('Dobrý den, teď to nikdo nemůže vzít. Nechte prosím vzkaz po pípnutí.'),
    // Messages waiting for the assistant: the --wait watcher reads them.
    // Relative to Miládka's folder; not backed up (it lives with the program).
    queue_file: z.string().min(1).default('.doplnky/mcp-phone/prichozi.jsonl'),
  })
  .strict();

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
    // One line for every call: when, to whom, what was said, how it went.
    // Relative to Miládka's folder; null switches it off.
    call_log: z.string().min(1).nullable().default('system/hovory/hovory.md'),
    conversation: conversationSchema.prefault({}),
    incoming: incomingSchema.prefault({}),
  })
  .strict();

export type Conversation = z.infer<typeof conversationSchema>;
export type Incoming = z.infer<typeof incomingSchema>;
export type Settings = z.infer<typeof settingsSchema>;

const keysSchema = z
  .object({
    account_sid: z.string().regex(/^AC[0-9a-f]{32}$/, 'Account SID začíná AC a má 34 znaků'),
    api_key: z.string().regex(/^SK[0-9a-f]{32}$/, 'SID API klíče začíná SK a má 34 znaků'),
    api_secret: z.string().min(16, 'Secret API klíče je kratší, než by měl být'),
    // Optional: the call session then bills this Anthropic API key instead of
    // the Claude subscription it is logged in with.
    anthropic_api_key: z.string().startsWith('sk-ant-', 'klíč Anthropicu začíná sk-ant-').optional(),
    // Unguessable part of the address Twilio sends incoming calls to, the only
    // thing that guards it. Here and not in the settings: those are backed up
    // to git (Věrka 9. 10. 2026). --setup-incoming writes it, nobody reads it.
    incoming_secret: z.string().regex(/^[A-Za-z0-9_-]{24,}$/, 'aspoň 24 znaků z písmen, číslic, - a _').optional(),
  })
  .strict();

export type Keys = z.infer<typeof keysSchema>;

export interface Config {
  settings: Settings;
  keys: Keys;
  configPath: string;
  /** The passwords file the keys came from; null when they came from the environment. */
  passwordsPath: string | null;
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
  const incoming_secret = process.env['PHONE_INCOMING_SECRET'];
  const parsed = keysSchema.safeParse({ account_sid, api_key, api_secret, ...(incoming_secret !== undefined ? { incoming_secret } : {}) });
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
  let passwordsPath: string | null = null;
  if (keys === null) {
    passwordsPath =
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

  return { settings, keys, configPath, passwordsPath };
}
