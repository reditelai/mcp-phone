// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

/**
 * A two-way conversation with the owner (phase 2).
 *
 * Twilio's ConversationRelay turns speech into text and text into speech and
 * talks to a WebSocket. The bridge here is that WebSocket: it passes what the
 * owner said to a separate Claude session and streams the answer back. The
 * bridge exists only for the length of one call - it opens when the call is
 * placed and closes when it ends - so nothing has to run on the machine
 * between calls.
 *
 * The call session is isolated on purpose. It loads no settings, no hooks and
 * no MCP servers from disk, only the read tools for the vault, a hang-up tool
 * and the servers named in the settings. A second session that picked up the
 * vault's .mcp.json would start the WhatsApp add-on a second time, and two
 * connections of one device knock each other off.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { createSdkMcpServer, query, tool, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { WebSocketServer, type WebSocket } from 'ws';

import type { Config } from './config.js';
import { ToolError } from './errors.js';
import { vaultRoot } from './location.js';
import { FINAL, fetchCall, placeTwimlCall, type CallInfo } from './twilio.js';

export interface Line {
  who: 'owner' | 'assistant';
  text: string;
}

export interface ConversationResult extends CallInfo {
  transcript: Line[];
  transcript_file: string | null;
  ended_by: 'owner' | 'assistant' | 'time_limit' | 'not_connected';
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** An executable by name from PATH, or the path as given. */
function findExecutable(name: string): string {
  if (name.includes('/') || name.includes('\\')) return name;
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    for (const ext of exts) {
      const candidate = join(dir, name + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new ToolError('claude_not_found', `The Claude Code executable "${name}" was not found. Set conversation.claude_path to its full path.`);
}

export function conversationVaultDir(config: Config): string {
  const base = vaultRoot() ?? dirname(resolve(config.configPath));
  const dir = config.settings.conversation.vault_dir;
  return dir === undefined ? base : resolve(base, dir);
}

/** Whether a path the call session wants to read is inside the vault and outside the secrets. */
function readable(vaultDir: string, path: unknown): boolean {
  if (path === undefined || path === null || path === '') return true; // defaults to the vault itself
  if (typeof path !== 'string') return false;
  const full = isAbsolute(path) ? resolve(path) : resolve(vaultDir, path);
  const rel = relative(vaultDir, full);
  if (rel.startsWith('..') || isAbsolute(rel)) return false;
  const parts = rel.split(sep);
  return !parts.includes('secrets') && !parts.includes('.git') && !parts.some((part) => part.startsWith('.env'));
}

function systemPrompt(config: Config, vaultDir: string, context: string): string {
  const conv = config.settings.conversation;
  const parts = [
    'You are on a phone call with the owner, the person you assist. Everything you write is read out loud to them by a speech synthesizer and their speech reaches you as text.',
    'Speak the language of the conversation. Answer briefly, one to three sentences, the way people talk on the phone. No lists, headings, links, markdown or anything that cannot be said out loud; write numbers, dates and times the way they are spoken.',
    'Before looking something up, say a short sentence first ("moment, podívám se") so the line is not silent.',
    'You cannot send, change or delete anything during the call. When the owner asks for that, say you will prepare it and that they will confirm it in writing afterwards; the whole call is handed over as a transcript when it ends.',
    'Never read out passwords, keys or anything from .miladka/secrets.',
    'When the owner says goodbye or that this is all, say goodbye in one short sentence and call the hang_up tool. Do not hang up on your own otherwise.',
    `Today is ${new Date().toLocaleString('cs-CZ', { timeZone: config.settings.timezone })} (${config.settings.timezone}).`,
  ];
  if (conv.vault_read) parts.push(`The owner's notes are in ${vaultDir}; you may read them with Read, Grep and Glob.`);
  if (context.trim() !== '') parts.push(`Why this call was placed: ${context.trim()}`);
  const persona = resolve(vaultDir, conv.persona_file);
  if (readable(vaultDir, persona) && existsSync(persona)) {
    parts.push(`Who you are and how you talk with the owner (your own rules, ${conv.persona_file}):\n${readFileSync(persona, 'utf8').slice(0, 20_000)}`);
  }
  return parts.join('\n\n');
}

/** A quick Cloudflare tunnel for the length of one call; resolves to its https address. */
function openTunnel(config: Config): Promise<{ url: string; process: ChildProcess }> {
  const conv = config.settings.conversation;
  return new Promise((done, fail) => {
    const child = spawn(conv.cloudflared_path, ['tunnel', '--no-autoupdate', '--url', `http://${conv.listen_host}:${conv.listen_port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => {
      child.kill();
      fail(new ToolError('tunnel_failed', 'The Cloudflare tunnel did not come up within 30 seconds.'));
    }, 30_000);
    const watch = (chunk: Buffer): void => {
      const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(chunk.toString());
      if (match) {
        clearTimeout(timer);
        done({ url: match[0], process: child });
      }
    };
    child.stdout.on('data', watch);
    child.stderr.on('data', watch);
    child.on('error', (error) => {
      clearTimeout(timer);
      fail(new ToolError('tunnel_failed', `cloudflared could not start (${error.message}). Set conversation.cloudflared_path.`));
    });
  });
}

/** Wait until the bridge answers through its public address, so Twilio does not connect into a void. */
async function waitReachable(base: string): Promise<void> {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(4000) });
      if (response.ok) return;
    } catch {
      // not yet
    }
    await new Promise((wait) => setTimeout(wait, 1000));
  }
  throw new ToolError('bridge_unreachable', `Twilio could not reach the bridge at ${base}. Check the reverse proxy or the tunnel.`);
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((done, fail) => {
    server.once('error', (error: NodeJS.ErrnoException) =>
      fail(
        error.code === 'EADDRINUSE'
          ? new ToolError('line_busy', `Port ${port} is taken - another call is probably in progress.`)
          : new ToolError('bridge_failed', `The bridge could not listen on ${host}:${port}: ${error.message}`),
      ),
    );
    server.listen(port, host, () => done());
  });
}

/** Rough time the synthesizer needs to say a text, so a hang-up does not cut the goodbye. */
function speakingMs(text: string): number {
  return Math.max(1500, text.length * 70);
}

export async function converse(config: Config, opening: string, context: string): Promise<ConversationResult> {
  const { settings, keys } = config;
  const conv = settings.conversation;
  const vaultDir = conversationVaultDir(config);
  const claude = findExecutable(conv.claude_path);
  const secret = randomBytes(24).toString('hex');
  const transcript: Line[] = [];
  let endedBy: ConversationResult['ended_by'] = 'not_connected';
  let ourCall = '';

  const server = createServer((request, response) => {
    response.writeHead(request.url === '/health' ? 200 : 404);
    response.end();
  });
  const sockets = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    // Only the address handed to Twilio for this one call opens the bridge.
    if (request.url !== `/relay/${secret}`) {
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (ws) => sockets.emit('connection', ws));
  });

  let finished: () => void = () => {};
  const ended = new Promise<void>((done) => (finished = done));

  sockets.on('connection', (ws: WebSocket) => {
    let session: ReturnType<typeof startSession> | null = null;
    ws.on('message', (data) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      if (message['type'] === 'setup') {
        // Only our own call, from our number to the owner.
        if (message['callSid'] !== ourCall || message['from'] !== settings.from || message['to'] !== settings.owner || session !== null) {
          ws.close();
          return;
        }
        endedBy = 'owner';
        session = startSession(config, vaultDir, claude, context, ws, transcript, () => {
          endedBy = 'assistant';
        });
      } else if (message['type'] === 'prompt' && message['last'] === true && session !== null) {
        const text = String(message['voicePrompt'] ?? '').trim();
        if (text !== '') session.say(text);
      } else if (message['type'] === 'interrupt' && session !== null) {
        session.interrupt();
      }
    });
    ws.on('close', () => {
      session?.close();
      finished();
    });
  });

  let tunnel: ChildProcess | null = null;
  try {
    await listen(server, conv.listen_host, conv.listen_port);
    let base: string;
    if (conv.public_url !== undefined) {
      base = conv.public_url;
    } else if (conv.tunnel === 'quick') {
      const opened = await openTunnel(config);
      tunnel = opened.process;
      base = opened.url;
    } else {
      throw new ToolError('no_public_address', 'The conversation needs conversation.public_url or conversation.tunnel "quick".');
    }
    await waitReachable(base);

    const voice = settings.voice.replace(/^ElevenLabs\./, '');
    const relay = `${base.replace(/^https:/, 'wss:')}/relay/${secret}`;
    const twiml =
      `<Response><Connect><ConversationRelay url="${escapeXml(relay)}" language="${escapeXml(settings.language)}" ` +
      `ttsProvider="ElevenLabs" voice="${escapeXml(voice)}" welcomeGreeting="${escapeXml(opening)}" /></Connect></Response>`;
    let info = await placeTwimlCall(keys, settings, settings.owner, twiml, conv.max_minutes * 60);
    ourCall = info.sid;

    // Wait for the call to end: the relay closes, or Twilio says the call is over.
    const deadline = Date.now() + (conv.max_minutes * 60 + 120) * 1000;
    while (Date.now() < deadline) {
      const tick = await Promise.race([ended.then(() => 'closed'), new Promise((wait) => setTimeout(() => wait('poll'), 5000))]);
      info = await fetchCall(keys, info.sid);
      if (FINAL.has(info.status) && (tick === 'closed' || endedBy === 'not_connected')) break;
    }
    if (!FINAL.has(info.status)) endedBy = 'time_limit';

    return { ...info, transcript, transcript_file: writeTranscript(config, vaultDir, context, transcript), ended_by: endedBy };
  } finally {
    sockets.close();
    server.close();
    tunnel?.kill();
  }
}

function writeTranscript(config: Config, vaultDir: string, context: string, transcript: Line[]): string | null {
  if (transcript.length === 0) return null;
  const now = new Date();
  const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: config.settings.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(now)
    .replace(' ', '-')
    .replace(':', '');
  const dir = resolve(vaultDir, config.settings.conversation.transcript_dir);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${stamp}-hovor.md`);
  const lines = transcript.map((line) => `**${line.who === 'owner' ? 'Majitel' : 'Asistentka'}:** ${line.text}`);
  writeFileSync(file, [`# Hovor ${stamp}`, '', context.trim() === '' ? '' : `Proč: ${context.trim()}\n`, ...lines, ''].join('\n'));
  return relative(vaultDir, file);
}

/** The Claude session behind one call. */
function startSession(config: Config, vaultDir: string, claude: string, context: string, ws: WebSocket, transcript: Line[], onHangUp: () => void) {
  const conv = config.settings.conversation;
  const pending: Array<string | null> = [];
  let wake: (() => void) | null = null;
  let hangUp = false;
  let spoken = '';

  async function* input(): AsyncGenerator<SDKUserMessage> {
    for (;;) {
      while (pending.length === 0) await new Promise<void>((done) => (wake = done));
      const text = pending.shift();
      if (text === null || text === undefined) return;
      yield { type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null };
    }
  }
  const push = (text: string | null): void => {
    pending.push(text);
    const w = wake;
    wake = null;
    w?.();
  };

  const hangUpServer = createSdkMcpServer({
    name: 'phone_call',
    tools: [
      tool('hang_up', 'End the phone call after your last sentence has been spoken. Only after saying goodbye.', {}, async () => {
        hangUp = true;
        return { content: [{ type: 'text', text: 'The call ends once your last sentence has been spoken.' }] };
      }),
    ],
  });
  const readTools = conv.vault_read ? ['Read', 'Grep', 'Glob'] : [];
  const allowed = new Set(['mcp__phone_call__hang_up', ...conv.allowed_tools]);
  const env: Record<string, string | undefined> = { ...process.env };
  if (config.keys.anthropic_api_key !== undefined) env['ANTHROPIC_API_KEY'] = config.keys.anthropic_api_key;
  else delete env['ANTHROPIC_API_KEY'];

  const session = query({
    prompt: input(),
    options: {
      model: conv.model,
      cwd: vaultDir,
      pathToClaudeCodeExecutable: claude,
      env,
      settingSources: [],
      strictMcpConfig: true,
      mcpServers: { ...conv.mcp_servers, phone_call: hangUpServer },
      tools: readTools,
      disallowedTools: ['Read(./.miladka/secrets/**)', 'Read(**/secrets/**)'],
      includePartialMessages: true,
      systemPrompt: systemPrompt(config, vaultDir, context),
      canUseTool: async (name, input) => {
        if (readTools.includes(name)) {
          const path = input['file_path'] ?? input['path'];
          return readable(vaultDir, path) ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'Outside the notes or in the secrets folder.' };
        }
        return allowed.has(name) ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'Not available during a phone call.' };
      },
    },
  });

  (async () => {
    for await (const message of session) {
      if (message.type === 'stream_event') {
        const event = message.event as { type?: string; delta?: { type?: string; text?: string } };
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
          spoken += event.delta.text;
          ws.send(JSON.stringify({ type: 'text', token: event.delta.text, last: false }));
        }
      } else if (message.type === 'result') {
        ws.send(JSON.stringify({ type: 'text', token: '', last: true }));
        if (spoken.trim() !== '') transcript.push({ who: 'assistant', text: spoken.trim() });
        const said = spoken;
        spoken = '';
        if (hangUp) {
          onHangUp();
          setTimeout(() => ws.send(JSON.stringify({ type: 'end' })), speakingMs(said));
        }
      }
    }
  })().catch(() => ws.close());

  return {
    say(text: string): void {
      transcript.push({ who: 'owner', text });
      push(text);
    },
    interrupt(): void {
      void session.interrupt().catch(() => {});
    },
    close(): void {
      push(null);
    },
  };
}
