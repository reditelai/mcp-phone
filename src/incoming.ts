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

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';

import { WebSocketServer, type WebSocket } from 'ws';

import { logCall } from './calllog.js';
import { loadConfig, OWNER, type Config } from './config.js';
import {
  conversationVaultDir,
  escapeXml,
  findExecutable,
  listen,
  relayHints,
  relayTranscription,
  relayVoice,
  speakingMs,
  startSession,
  writeTranscript,
  type Callee,
  type Line,
} from './conversation.js';
import { gapLines, readWav, speech, splitChannels } from './measure.js';
import { callParties, deleteRecording, downloadRecording, downloadRecordingWav, findNumber, listRecordings, recordingStatus, startRecording } from './twilio.js';

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

function collected(config: Config): string[] {
  const state = statePath(config);
  return existsSync(state) ? ((JSON.parse(readFileSync(state, 'utf8')) as { zpracovane?: string[] }).zpracovane ?? []) : [];
}

/** A recording the voicemail collector must not take (or has taken). */
function markCollected(config: Config, sid: string): void {
  const state = statePath(config);
  const done = collected(config);
  done.push(sid);
  mkdirSync(dirname(state), { recursive: true });
  writeFileSync(state, JSON.stringify({ zpracovane: done.slice(-500) }, null, 2));
}

/** One message for the assistant, a line of JSON in the queue file. */
export interface QueuedMessage {
  /**
   * "rozhovor": the secretary took it; "zaznamnik": a recording while the service was off; "odmitnuto": rejected, not forwarded from the owner's numbers;
   * "majitel": the owner called with his PIN and talked to the assistant; "pin": a wrong PIN from the owner's number (soubor null).
   */
  druh: 'rozhovor' | 'zaznamnik' | 'odmitnuto' | 'majitel' | 'pin';
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
 * the country code sometimes (777123456 for +420777123456), so the national
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

/** The owner's own numbers: the one Miládka calls and the lines in incoming.owner_lines. */
export function ownerLine(config: Config, number: string): boolean {
  return [config.settings.owner, ...(config.settings.incoming.owner_lines ?? [])].some((line) => sameNumber(line, number));
}

/** Wrong PINs: three in a call end it, ten in a day switch the PIN off until tomorrow. */
export const PIN_TRIES_PER_CALL = 3;
export const PIN_FAILURES_PER_DAY = 10;

/** What the session is told when the owner got through with the PIN. */
const OWNER_CALLED = 'The owner called you himself and confirmed it with his PIN. There is no other reason for the call: listen to what he wants.';

export function pinMatches(pin: string, digits: string): boolean {
  const a = Buffer.from(pin);
  const b = Buffer.from(digits.replace(/\D/g, ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

function pinPath(config: Config): string {
  return join(dirname(queuePath(config)), 'prichozi-pin.json');
}

function today(config: Config): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: config.settings.timezone }).format(new Date());
}

function pinFailures(config: Config): number {
  const file = pinPath(config);
  if (!existsSync(file)) return 0;
  const state = JSON.parse(readFileSync(file, 'utf8')) as { den?: string; chyby?: number };
  return state.den === today(config) ? (state.chyby ?? 0) : 0;
}

/** Kept in a file, not in memory: a restart must not give a guesser new tries. */
export function pinLocked(config: Config): boolean {
  return pinFailures(config) >= PIN_FAILURES_PER_DAY;
}

/** Counts a wrong PIN; true once the PIN is off for the rest of the day. */
export function addPinFailure(config: Config): boolean {
  const file = pinPath(config);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ den: today(config), chyby: pinFailures(config) + 1 }));
  return pinLocked(config);
}

/** The holiday in force today (until its last day, inclusive), or null. */
export function onVacation(config: Config): NonNullable<Config['settings']['incoming']['vacation']> | null {
  const vacation = config.settings.incoming.vacation;
  return vacation !== undefined && today(config) <= vacation.until ? vacation : null;
}

/** The secretary's task while the owner is away: no promise of a quick call back. */
export function vacationTask(task: string, vacation: NonNullable<Config['settings']['incoming']['vacation']>): string {
  const extra = [
    `The owner is on holiday until ${vacation.until} (the caller already heard it in the greeting). Do not say or suggest that he will call back soon; say he will get the message and get back to them after the holiday.`,
    vacation.substitute !== undefined
      ? `When the caller says it is urgent or asks whom to turn to, tell them, in your own words and only this: ${vacation.substitute}`
      : 'Nobody stands in for him; when it is urgent, take the message and say you will pass it on as urgent.',
  ];
  return `${task} ${extra.join(' ')}`;
}

/** What is wrong with the PIN in the keys file, or null. A wrong one turns off only the PIN, not the service. */
export function pinProblem(pin: string): string | null {
  return /^\d{4,10}$/.test(pin) ? null : 'PIN v souboru s klíči nemá 4 až 10 číslic';
}

/** Asks for the PIN on the keypad; no keys pressed = goodbye. */
function pinTwiml(config: Config, base: string, pin: string, text: string): string {
  return twiml(
    `<Gather input="dtmf" numDigits="${pin.length}" timeout="6" action="${escapeXml(`${base}/pin`)}" method="POST">${say(config, text)}</Gather>` +
      `${say(config, texts(config).bye)}<Hangup/>`,
  );
}

/** What a caller gets when the secretary is off: a short message and the beep. */
export function voicemailTwiml(config: Config): string {
  return twiml(`${say(config, config.settings.incoming.voicemail_text)}<Record maxLength="120" playBeep="true" timeout="5"/>${say(config, texts(config).thanks)}`);
}

/** What the service itself says, by the language of the settings (until 0.3.15 always Czech). */
const TEXTS = {
  cs: {
    pin: 'Zadej PIN.',
    again: 'To nesedí. Zadej PIN znovu.',
    bye: 'Na shledanou.',
    thanks: 'Děkuji, na shledanou.',
    closing: 'Omlouvám se, už musím končit. Vzkaz předám. Na shledanou.',
  },
  en: {
    pin: 'Enter your PIN.',
    again: 'That is not right. Enter your PIN again.',
    bye: 'Goodbye.',
    thanks: 'Thank you, goodbye.',
    closing: 'I am sorry, I have to end the call now. I will pass the message on. Goodbye.',
  },
};

export function texts(config: Config): (typeof TEXTS)['cs'] {
  return config.settings.language.toLowerCase().startsWith('cs') ? TEXTS.cs : TEXTS.en;
}

/** Runs until stopped. */
export async function serve(config: Config, configPath?: string): Promise<void> {
  let { settings, keys } = config;
  let conv = settings.conversation;
  let incoming = settings.incoming;
  const problems = incomingProblems(config);
  if (problems.length > 0) throw new Error(`Příchozí hovory nejdou spustit: ${problems.join('; ')}.`);
  const base = incomingBase(config)!;
  const prefix = `/prichozi/${config.keys.incoming_secret}`;
  let vaultDir = conversationVaultDir(config);
  let claude = findExecutable(conv.claude_path);
  const log = (line: string): void => {
    process.stderr.write(`${new Date().toISOString()} ${line}\n`);
  };

  // The service runs for days: a changed phone.json is read again before the
  // next call. Until 0.3.12 it was read only at start, and a whole afternoon
  // of test calls ran on the old values (12. 10. 2026). The address and the
  // port stay as they were until a restart.
  const loadedAt = (): number => (configPath !== undefined && existsSync(configPath) ? statSync(configPath).mtimeMs : 0);
  let loaded = loadedAt();
  const refresh = async (): Promise<void> => {
    const now = loadedAt();
    if (configPath === undefined || now === loaded) return;
    loaded = now;
    try {
      const next = await loadConfig(configPath);
      config = next;
      ({ settings, keys } = next);
      conv = settings.conversation;
      incoming = settings.incoming;
      vaultDir = conversationVaultDir(next);
      claude = findExecutable(conv.claude_path);
      if (incomingBase(next) !== base) log('nastavení: adresa služby se změnila, platí až po restartu');
      log('nastavení: změněné, načteno znovu');
    } catch (error) {
      log(`nastavení: změna nejde načíst, platí dosavadní (${error instanceof Error ? error.message : String(error)})`);
    }
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
    /** The relay connected: the secretary is on the line. */
    connected: boolean;
    /** A recording for measuring the gaps (incoming.measure_gaps), from when by the server's clock. */
    recording?: { sid: string; startedAt: number };
  }
  let current: Call | null = null;

  const finish = (call: Call): void => {
    if (call.finished) return;
    call.finished = true;
    call.session.close();
    if (current === call) current = null;
    const seconds = Math.round((Date.now() - call.startedAt) / 1000);
    // The secretary never got on the line (Twilio refused the TwiML, or the
    // caller hung up during the greeting): nothing to hand over, but the
    // failure belongs in the log instead of a call that hangs (10. 10. 2026).
    if (!call.connected) {
      logCall(config, {
        who: `${call.from || 'neznámé číslo'}${call.forwardedFrom ? ` (přesměrováno z ${call.forwardedFrom})` : ''}`,
        kind: 'příchozí',
        info: { sid: call.sid, status: 'failed', duration_seconds: seconds, started: new Date(call.startedAt).toISOString(), ring_seconds: null },
      });
      log(`hovor od ${call.from}: sekretářka se nespojila (${call.endedBy}), uzavřeno po ${seconds} s`);
      return;
    }
    const deliver = (): void => {
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
      enqueue(config, { druh: call.callee.owner ? 'majitel' : 'rozhovor', cas: new Date(call.startedAt).toISOString(), od: call.from, presmerovano_z: call.forwardedFrom, delka_s: seconds, soubor: file });
      log(`hovor od ${call.from} skončil (${call.endedBy}), ${seconds} s`);
    };
    // The measured gaps go into the transcript before anyone reads it.
    if (call.recording === undefined) deliver();
    else void measure(call, call.recording).finally(deliver);
  };

  /** Gaps from the call's recording into its transcript; the recording leaves Twilio either way. */
  const measure = async (call: Call, recording: { sid: string; startedAt: number }): Promise<void> => {
    try {
      const deadline = Date.now() + 90_000;
      while ((await recordingStatus(keys, recording.sid)) !== 'completed') {
        if (Date.now() > deadline) throw new Error('nahrávka nebyla do 90 s hotová');
        await new Promise((wait) => setTimeout(wait, 3000));
      }
      const wav = readWav(await downloadRecordingWav(keys, recording.sid));
      const sides = splitChannels(wav.channels.map((samples) => speech(samples, wav.rate)));
      if (sides === null) throw new Error(`nahrávka má ${wav.channels.length} stop místo dvou`);
      const lines = gapLines(sides.caller, sides.assistant, call.session.events, recording.startedAt);
      for (const text of lines.length > 0 ? lines : ['měření: v nahrávce žádná výměna']) call.transcript.push({ who: 'tool', text });
    } catch (error) {
      call.transcript.push({ who: 'tool', text: `měření se nepovedlo: ${error instanceof Error ? error.message : String(error)}` });
    }
    try {
      await deleteRecording(keys, recording.sid);
    } catch (error) {
      log(`měření: nahrávku ${recording.sid} se nepodařilo smazat z Twilia: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const server = createServer((request, response) => {
    const url = request.url ?? '';
    if (url === `${prefix}/health`) {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('ok');
      return;
    }
    // Twilio's status callback for the number: a call that ended closes here
    // even when nothing else said so (a refused TwiML never reaches /done).
    if (url === `${prefix}/status` && request.method === 'POST') {
      void readBody(request).then((form) => {
        const status = form.get('CallStatus') ?? '';
        const call = current;
        if (call !== null && call.sid === form.get('CallSid') && ['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(status)) {
          if (!call.connected) call.endedBy = `Twilio: ${status}`;
          finish(call);
        }
        response.writeHead(204);
        response.end();
      });
      return;
    }
    if (url === `${prefix}/done` && request.method === 'POST') {
      response.writeHead(200, { 'Content-Type': 'text/xml' });
      response.end(twiml('<Hangup/>'));
      return;
    }
    if ((url !== `${prefix}/voice` && url !== `${prefix}/pin`) || request.method !== 'POST') {
      response.writeHead(404);
      response.end();
      return;
    }
    void readBody(request).then(async (form) => {
      await refresh();
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
      const pin = keys.owner_pin;
      // With a PIN set, a direct call from the owner's own number gets his
      // assistant with the right PIN, or ends: no secretary for it, she is
      // tried through forwarding from another phone (Karel, 12. 10. 2026).
      // Without a PIN set, the secretary takes it as before.
      const ownerDirect = forwardedFrom === '' && ownerLine(config, from);
      if (url === `${prefix}/voice` && ownerDirect && pin !== undefined) {
        const problem = pinProblem(pin) ?? (pinLocked(config) ? 'PIN je dnes po deseti špatných pokusech vypnutý' : null);
        if (problem !== null) {
          log(`hovor od ${from}: ${problem}, položeno`);
          response.end(twiml(`${say(config, texts(config).bye)}<Hangup/>`));
          enqueue(config, { druh: 'pin', cas: new Date().toISOString(), od: from, presmerovano_z: '', delka_s: 0, soubor: null });
          return;
        }
        response.end(pinTwiml(config, base, pin, texts(config).pin));
        return;
      }
      if (url === `${prefix}/pin`) {
        if (pin === undefined || pinProblem(pin) !== null || !ownerDirect || pinLocked(config)) {
          response.end(twiml('<Hangup/>'));
          return;
        }
        if (!pinMatches(pin, form.get('Digits') ?? '')) {
          const tries = (pinTries.get(sid) ?? 0) + 1;
          pinTries.set(sid, tries);
          const locked = addPinFailure(config);
          log(`hovor od ${from}: špatný PIN (${tries}. pokus v hovoru)`);
          if (tries < PIN_TRIES_PER_CALL && !locked) {
            response.end(pinTwiml(config, base, pin, texts(config).again));
            return;
          }
          pinTries.delete(sid);
          response.end(twiml(`${say(config, texts(config).bye)}<Hangup/>`));
          enqueue(config, { druh: 'pin', cas: new Date().toISOString(), od: from, presmerovano_z: '', delka_s: 0, soubor: null });
          if (locked) log('PIN: dnes příliš mnoho špatných pokusů, do zítřka vypnutý');
          return;
        }
        pinTries.delete(sid);
        log(`hovor od ${from}: PIN v pořádku, majitel`);
        const callee: Callee = { number: from, name: settings.language.startsWith('cs') ? 'majitel' : OWNER, owner: true };
        response.end(connect(sid, from, '', callee, conv.greeting, OWNER_CALLED));
        return;
      }
      const callee: Callee = { number: from, name: `příchozí ${from || 'neznámé číslo'}`, owner: false, incoming: true };
      log(`hovor od ${from}${forwardedFrom ? ` (přesměrováno z ${forwardedFrom})` : ''}`);
      const away = onVacation(config);
      response.end(connect(sid, from, forwardedFrom, callee, away?.greeting ?? incoming.greeting, away === null ? incoming.task : vacationTask(incoming.task, away)));
    });
  });

  /** Wrong PINs within one call, by call sid. */
  const pinTries = new Map<string, number>();

  /**
   * Starts the session for a call and returns the TwiML that connects it:
   * the isolated secretary, or the owner's own assistant after the PIN.
   */
  const connect = (sid: string, from: string, forwardedFrom: string, callee: Callee, greeting: string, context: string): string => {
    const transcript: Line[] = [];
    const call: Call = {
      sid,
      from,
      forwardedFrom,
      relaySecret: randomBytes(24).toString('hex'),
      callee,
      transcript,
      session: startSession(config, vaultDir, claude, callee, greeting, context, transcript, () => {
        call.endedBy = 'assistant';
      }),
      startedAt: Date.now(),
      endedBy: 'caller',
      finished: false,
      connected: false,
    };
    current = call;
    // A call whose relay never connects is closed after a minute, with the
    // session. Not by an empty transcript: the warm-up writes a timing line
    // into it, and the call hung until a restart (10. 10. 2026).
    setTimeout(() => {
      if (!call.finished && !call.connected && current === call) {
        call.endedBy = 'nepřipojeno do minuty';
        finish(call);
      }
    }, 60_000).unref();
    const relay = `${base.replace(/^https:/, 'wss:')}/relay/${call.relaySecret}`;
    // The owner's call listens like a call Miládka places to him; the
    // secretary waits incoming.speech_timeout_ms for a message said in pieces.
    // The owner's cheat sheet of names serves his own call too ("Jarku" came through as "Jirku", 13. 10. 2026).
    const timing = (callee.owner || incoming.speech_timeout_ms === null ? '' : ` speechTimeout="${incoming.speech_timeout_ms}"`) + relayHints(config, incoming.hints);
    return twiml(
      `<Connect action="${escapeXml(`${base}/done`)}"><ConversationRelay url="${escapeXml(relay)}" language="${escapeXml(settings.language)}" ` +
        `ttsProvider="ElevenLabs" voice="${escapeXml(relayVoice(config))}" welcomeGreeting="${escapeXml(greeting)}"${relayTranscription(config)}${timing} /></Connect>`,
    );
  };

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
        call.connected = true;
        call.session.attach(ws);
        if (incoming.measure_gaps) {
          // The recording's start by our clock: halfway through the request, to a few tenths of a second.
          const before = Date.now();
          void startRecording(keys, call.sid)
            .then((sid) => {
              // Not voicemail: the collector must leave it alone.
              markCollected(config, sid);
              call.recording = { sid, startedAt: (before + Date.now()) / 2 };
            })
            .catch((error: unknown) => log(`měření: nahrávání se nespustilo: ${error instanceof Error ? error.message : String(error)}`));
        }
        // The secretary is short (Karel: "klidně přísnější, 2-3 min"); the owner's own call is as long as one Miládka places.
        limit = setTimeout(() => {
          const closing = texts(config).closing;
          ws.send(JSON.stringify({ type: 'text', token: closing, last: true }));
          call.transcript.push({ who: 'assistant', text: closing });
          call.endedBy = 'time_limit';
          setTimeout(() => ws.send(JSON.stringify({ type: 'end' })), speakingMs(closing));
        }, (call.callee.owner ? conv.max_minutes : incoming.max_minutes) * 60_000);
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
  let saved = 0;
  for (const recording of await listRecordings(keys)) {
    if (collected(config).includes(recording.sid)) continue;
    const parties = await callParties(keys, recording.call_sid);
    // Read again: a measuring recording of a running call is marked meanwhile.
    if (parties.to !== settings.from || collected(config).includes(recording.sid)) continue;
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
    markCollected(config, recording.sid);
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
