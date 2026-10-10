// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

/**
 * Incoming calls (phase 2, server only): a secretary that takes a message.
 *
 * The owner forwards the calls he does not pick up to his Twilio number, and
 * Twilio sends each of them to this service, which runs all the time
 * (`--serve`, a systemd service). The caller talks to the same isolated
 * session as a call to someone else: an empty folder, no settings, no MCP
 * servers, no tools but hang_up, nothing from the vault, even when the
 * caller's number is the owner's (caller ID can be faked). The service, not
 * the session, writes the transcript and the call log and leaves a line in
 * the queue; the assistant's watcher (`--wait`) picks it up and the assistant
 * tells the owner.
 *
 * When the service is off, or switched off for holidays, the caller hears a
 * short message and can leave a recording (a Twilio fallback set up once by
 * the owner). The service downloads such recordings when it runs, saves them
 * with the transcripts and deletes them from Twilio.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { randomBytes } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';

import { WebSocketServer, type WebSocket } from 'ws';

import { logCall } from './calllog.js';
import type { Config } from './config.js';
import {
  conversationVaultDir,
  escapeXml,
  findExecutable,
  listen,
  relayTranscription,
  relayVoice,
  speakingMs,
  startSession,
  writeTranscript,
  type Callee,
  type Line,
} from './conversation.js';
import { callParties, deleteRecording, downloadRecording, findNumber, listRecordings } from './twilio.js';

/** Base of every address of the service: public_url/prichozi/<secret>. */
export function incomingBase(config: Config): string | null {
  const conv = config.settings.conversation;
  const secret = config.keys.incoming_secret;
  if (conv.public_url === undefined || secret === undefined) return null;
  return `${conv.public_url}/prichozi/${secret}`;
}

/**
 * What is missing before incoming calls may run, without asking the network.
 * Incoming calls need a fixed public address: a quick tunnel changes with
 * every start and Twilio would send calls nowhere (Karel, 9. 10. 2026: the
 * add-on itself has to stop a user who does not meet the conditions).
 */
export function incomingProblems(config: Config): string[] {
  const { conversation: conv, incoming } = config.settings;
  const problems: string[] = [];
  if (conv.public_url === undefined) problems.push('chybí conversation.public_url: příchozí hovory potřebují stálou adresu (server s doménou nebo pevný tunel)');
  if (conv.tunnel === 'quick') problems.push('conversation.tunnel je "quick": zkušební tunel mění adresu, pro příchozí hovory nejde');
  if (config.keys.incoming_secret === undefined) problems.push('chybí tajná část adresy v souboru s klíči (spusť --setup-incoming)');
  if (incoming.greeting === undefined) problems.push('chybí incoming.greeting (co volající uslyší, s „AI")');
  return problems;
}

function queuePath(config: Config): string {
  return resolve(conversationVaultDir(config), config.settings.incoming.queue_file);
}

function statePath(config: Config): string {
  return join(dirname(queuePath(config)), 'prichozi-stav.json');
}

/** One message for the assistant, a line of JSON in the queue file. */
export interface QueuedMessage {
  /** "rozhovor": the secretary took it; "zaznamnik": a recording while the service was off; "odmitnuto": rejected, not forwarded from the owner's numbers. */
  druh: 'rozhovor' | 'zaznamnik' | 'odmitnuto';
  cas: string;
  od: string;
  presmerovano_z: string;
  delka_s: number;
  /** Transcript or recording, relative to the vault. */
  soubor: string | null;
}

function enqueue(config: Config, message: QueuedMessage): void {
  const file = queuePath(config);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(message)}\n`);
}

function readBody(request: IncomingMessage): Promise<URLSearchParams> {
  return new Promise((done) => {
    let data = '';
    request.on('data', (chunk: Buffer) => {
      data += chunk.toString();
      if (data.length > 100_000) request.destroy();
    });
    request.on('end', () => done(new URLSearchParams(data)));
    request.on('error', () => done(new URLSearchParams()));
  });
}

function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

function say(config: Config, text: string): string {
  const { settings } = config;
  return `<Say voice="${escapeXml(settings.voice)}" language="${escapeXml(settings.language)}">${escapeXml(text)}</Say>`;
}

/**
 * Whether two numbers are the same line. Twilio gives ForwardedFrom without
 * the country code sometimes (724925753 for +420724925753), so the national
 * part decides.
 */
export function sameNumber(a: string, b: string): boolean {
  const x = a.replace(/\D/g, '');
  const y = b.replace(/\D/g, '');
  if (x.length < 9 || y.length < 9) return false;
  return x.endsWith(y) || y.endsWith(x);
}

/**
 * Whether a call may reach the secretary. With owner_lines set: a call
 * forwarded from one of the owner's lines, or a direct call from one of them.
 * The secretary is equally isolated for everybody, so a faked caller ID gains
 * nothing.
 */
export function admitted(config: Config, from: string, forwardedFrom: string): boolean {
  const lines = config.settings.incoming.owner_lines;
  if (lines === undefined) return true;
  const ours = (number: string): boolean => lines.some((line) => sameNumber(line, number));
  return forwardedFrom !== '' ? ours(forwardedFrom) : ours(from);
}

/** What a caller gets when the secretary is off: a short message and the beep. */
export function voicemailTwiml(config: Config): string {
  return twiml(`${say(config, config.settings.incoming.voicemail_text)}<Record maxLength="120" playBeep="true" timeout="5"/>${say(config, 'Děkuji, na shledanou.')}`);
}

const CLOSING = 'Omlouvám se, už musím končit. Vzkaz předám. Na shledanou.';

/** Runs until stopped. */
export async function serve(config: Config): Promise<void> {
  const { settings, keys } = config;
  const conv = settings.conversation;
  const incoming = settings.incoming;
  const problems = incomingProblems(config);
  if (problems.length > 0) throw new Error(`Příchozí hovory nejdou spustit: ${problems.join('; ')}.`);
  const base = incomingBase(config)!;
  const prefix = `/prichozi/${config.keys.incoming_secret}`;
  const vaultDir = conversationVaultDir(config);
  const claude = findExecutable(conv.claude_path);
  const log = (line: string): void => {
    process.stderr.write(`${new Date().toISOString()} ${line}\n`);
  };

  interface Call {
    sid: string;
    from: string;
    forwardedFrom: string;
    relaySecret: string;
    callee: Callee;
    transcript: Line[];
    session: ReturnType<typeof startSession>;
    startedAt: number;
    endedBy: string;
    finished: boolean;
  }
  let current: Call | null = null;

  const finish = (call: Call): void => {
    if (call.finished) return;
    call.finished = true;
    call.session.close();
    if (current === call) current = null;
    const seconds = Math.round((Date.now() - call.startedAt) / 1000);
    let file: string | null = null;
    try {
      file = writeTranscript(config, vaultDir, '', call.transcript, call.callee);
    } catch (error) {
      log(`přepis se nepodařilo zapsat: ${error instanceof Error ? error.message : String(error)}`);
    }
    logCall(config, {
      who: `${call.from || 'neznámé číslo'}${call.forwardedFrom ? ` (přesměrováno z ${call.forwardedFrom})` : ''}`,
      kind: 'příchozí',
      info: { sid: call.sid, status: 'completed', duration_seconds: seconds, started: new Date(call.startedAt).toISOString(), ring_seconds: null },
      transcript: file,
    });
    enqueue(config, { druh: 'rozhovor', cas: new Date(call.startedAt).toISOString(), od: call.from, presmerovano_z: call.forwardedFrom, delka_s: seconds, soubor: file });
    log(`hovor od ${call.from} skončil (${call.endedBy}), ${seconds} s`);
  };

  const server = createServer((request, response) => {
    const url = request.url ?? '';
    if (url === `${prefix}/health`) {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('ok');
      return;
    }
    if (url === `${prefix}/done` && request.method === 'POST') {
      response.writeHead(200, { 'Content-Type': 'text/xml' });
      response.end(twiml('<Hangup/>'));
      return;
    }
    if (url !== `${prefix}/voice` || request.method !== 'POST') {
      response.writeHead(404);
      response.end();
      return;
    }
    void readBody(request).then((form) => {
      const sid = form.get('CallSid') ?? '';
      const from = form.get('From') ?? '';
      const forwardedFrom = form.get('ForwardedFrom') ?? '';
      response.writeHead(200, { 'Content-Type': 'text/xml' });
      if (!admitted(config, from, forwardedFrom)) {
        // Busy at once: nothing plays, nothing records, Twilio does not bill a rejected call.
        log(`hovor od ${from}: ${forwardedFrom ? `přesměrováno z ${forwardedFrom}, ne z čísel majitele` : 'přímý hovor z čísla, které není majitelovo'}, odmítnuto`);
        response.end(twiml('<Reject reason="busy"/>'));
        logCall(config, { who: `${from || 'neznámé číslo'}${forwardedFrom ? ` (přesměrováno z ${forwardedFrom})` : ''}`, kind: 'odmítnuto', info: { sid, status: 'busy', duration_seconds: 0, started: new Date().toISOString(), ring_seconds: null } });
        enqueue(config, { druh: 'odmitnuto', cas: new Date().toISOString(), od: from, presmerovano_z: forwardedFrom, delka_s: 0, soubor: null });
        return;
      }
      if (!incoming.enabled || incoming.greeting === undefined) {
        log(`hovor od ${from}: vypnuto, záznamník`);
        response.end(voicemailTwiml(config));
        return;
      }
      if (current !== null) {
        log(`hovor od ${from}: jiný hovor běží, obsazeno`);
        response.end(twiml('<Reject reason="busy"/>'));
        return;
      }
      const callee: Callee = { number: from, name: `příchozí ${from || 'neznámé číslo'}`, owner: false, incoming: true };
      const transcript: Line[] = [];
      const call: Call = {
        sid,
        from,
        forwardedFrom,
        relaySecret: randomBytes(24).toString('hex'),
        callee,
        transcript,
        // The isolated session: the same as for a call to someone else.
        session: startSession(config, vaultDir, claude, callee, incoming.greeting, incoming.task, transcript, () => {
          call.endedBy = 'assistant';
        }),
        startedAt: Date.now(),
        endedBy: 'caller',
        finished: false,
      };
      current = call;
      log(`hovor od ${from}${forwardedFrom ? ` (přesměrováno z ${forwardedFrom})` : ''}`);
      const voice = relayVoice(config);
      const relay = `${base.replace(/^https:/, 'wss:')}/relay/${call.relaySecret}`;
      response.end(
        twiml(
          `<Connect action="${escapeXml(`${base}/done`)}"><ConversationRelay url="${escapeXml(relay)}" language="${escapeXml(settings.language)}" ` +
            `ttsProvider="ElevenLabs" voice="${escapeXml(voice)}" welcomeGreeting="${escapeXml(incoming.greeting)}"${relayTranscription(config)} /></Connect>`,
        ),
      );
      // A call that never connects to the relay (caller hung up during the greeting) is closed after a minute.
      setTimeout(() => {
        if (!call.finished && call.transcript.length === 0 && current === call) finish(call);
      }, 60_000).unref();
    });
  });

  const sockets = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    const call = current;
    if (call === null || request.url !== `${prefix}/relay/${call.relaySecret}`) {
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (ws) => sockets.emit('connection', ws, call));
  });

  sockets.on('connection', (ws: WebSocket, call: Call) => {
    let mine = false;
    let limit: ReturnType<typeof setTimeout> | null = null;
    ws.on('message', (data) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      if (message['type'] === 'setup') {
        if (message['callSid'] !== call.sid || mine) {
          ws.close();
          return;
        }
        mine = true;
        call.session.attach(ws);
        // The secretary is short (Karel: "klidně přísnější, 2-3 min").
        limit = setTimeout(() => {
          ws.send(JSON.stringify({ type: 'text', token: CLOSING, last: true }));
          call.transcript.push({ who: 'assistant', text: CLOSING });
          call.endedBy = 'time_limit';
          setTimeout(() => ws.send(JSON.stringify({ type: 'end' })), speakingMs(CLOSING));
        }, incoming.max_minutes * 60_000);
      } else if (message['type'] === 'prompt' && message['last'] === true && mine) {
        const text = String(message['voicePrompt'] ?? '').trim();
        if (text !== '') call.session.say(text);
      } else if (message['type'] === 'interrupt' && mine) {
        call.session.interrupt(typeof message['utteranceUntilInterrupt'] === 'string' ? message['utteranceUntilInterrupt'] : undefined);
      }
    });
    ws.on('close', () => {
      if (limit !== null) clearTimeout(limit);
      if (mine) finish(call);
    });
  });

  await listen(server, conv.listen_host, incoming.listen_port);
  log(`příchozí hovory: služba běží na ${conv.listen_host}:${incoming.listen_port}, adresa ${conv.public_url}/prichozi/…, ${incoming.enabled ? 'zapnuto' : 'vypnuto (záznamník)'}`);

  try {
    const number = await findNumber(keys, settings);
    if (number.voice_url !== `${base}/voice`) log('POZOR: číslo v Twiliu neposílá hovory na tuhle službu. Spusť --setup-incoming.');
    if (number.voice_fallback_url === '') log('POZOR: číslo v Twiliu nemá záložní odpověď (fallback), při výpadku by volající slyšel chybu.');
  } catch (error) {
    log(`nastavení čísla v Twiliu se nepodařilo ověřit: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Recordings left while the service was off or on holiday.
  const collect = async (): Promise<void> => {
    try {
      await collectRecordings(config, log);
    } catch (error) {
      log(`záznamník: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  await collect();
  const every = setInterval(() => void collect(), 5 * 60_000);

  await new Promise<void>((done) => {
    process.once('SIGTERM', () => done());
    process.once('SIGINT', () => done());
  });
  clearInterval(every);
  if (current !== null) finish(current);
  server.close();
  sockets.close();
}

/**
 * Downloads voicemail recordings on calls to the owner's number, saves them
 * with the transcripts, logs and queues them, and deletes them from Twilio.
 */
export async function collectRecordings(config: Config, log: (line: string) => void): Promise<number> {
  const { settings, keys } = config;
  const state = statePath(config);
  const done: string[] = existsSync(state) ? ((JSON.parse(readFileSync(state, 'utf8')) as { zpracovane?: string[] }).zpracovane ?? []) : [];
  let saved = 0;
  for (const recording of await listRecordings(keys)) {
    if (done.includes(recording.sid)) continue;
    const parties = await callParties(keys, recording.call_sid);
    if (parties.to !== settings.from) continue;
    const vault = conversationVaultDir(config);
    const dir = resolve(vault, settings.conversation.transcript_dir);
    mkdirSync(dir, { recursive: true });
    const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: settings.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .format(new Date(recording.created))
      .replace(' ', '-')
      .replace(':', '');
    const file = join(dir, `${stamp}-zaznamnik-${parties.from.replace(/\D/g, '') || 'nezname'}.mp3`);
    writeFileSync(file, await downloadRecording(keys, recording.sid));
    const rel = relative(vault, file);
    logCall(config, {
      who: parties.from || 'neznámé číslo',
      kind: 'záznamník',
      info: { sid: recording.call_sid, status: 'completed', duration_seconds: recording.duration_seconds, started: recording.created, ring_seconds: null },
      transcript: rel,
    });
    enqueue(config, { druh: 'zaznamnik', cas: recording.created, od: parties.from, presmerovano_z: parties.forwarded_from, delka_s: recording.duration_seconds, soubor: rel });
    await deleteRecording(keys, recording.sid);
    done.push(recording.sid);
    mkdirSync(dirname(state), { recursive: true });
    writeFileSync(state, JSON.stringify({ zpracovane: done.slice(-500) }, null, 2));
    saved += 1;
    log(`záznamník: vzkaz od ${parties.from} uložen (${rel})`);
  }
  return saved;
}

/** Exit codes of the watcher, the same as the mail and WhatsApp watchers. */
export const WAIT_EXIT = { message: 0, restart: 4, usage: 6 } as const;

/**
 * The watcher: waits until a message is in the queue, prints it as one line
 * and ends, which wakes the assistant. The queue is emptied by moving it
 * aside first, so a message that arrives meanwhile is not lost.
 */
export async function waitForMessages(config: Config, maxMs: number, say: (line: string) => void): Promise<number> {
  const file = queuePath(config);
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (existsSync(file) && readFileSync(file, 'utf8').trim() !== '') {
      const taken = `${file}.${process.pid}`;
      renameSync(file, taken);
      const messages = readFileSync(taken, 'utf8')
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line) as QueuedMessage);
      unlinkSync(taken);
      say(`prichozi: ${JSON.stringify(messages)}`);
      return WAIT_EXIT.message;
    }
    await new Promise((wait) => setTimeout(wait, 5_000));
  }
  say('cas vyprsel: spust hlidani znovu');
  return WAIT_EXIT.restart;
}
