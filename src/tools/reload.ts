// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';

import { loadConfig, type Config } from '../config.js';
import { asJson, runTool } from './shared.js';

/**
 * Load the settings and keys again without a new conversation. The Claude app
 * on Windows cannot reconnect a server, so without this every change of quiet
 * hours or recipients would need a new conversation. A file that does not load
 * changes nothing.
 */
export function registerReloadTool(server: McpServer, current: () => Config, replace: (config: Config) => void): void {
  server.registerTool(
    'tel_reload_config',
    {
      description:
        'Load the settings and the Twilio keys again after you changed them. Nothing changes when the files do not load; ' +
        'the error says why. The result lists the settings now in force, never a key. ' +
        'A new version of the server itself still needs a new conversation.',
      annotations: { title: 'Reload phone settings', readOnlyHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: z.object({}),
    },
    async () =>
      runTool(async () => {
        const config = await loadConfig(current().configPath);
        replace(config);
        const { settings } = config;
        return asJson({
          reloaded: true,
          call_owner_when: settings.call_owner_when ?? [],
          recipients: Object.keys(settings.recipients),
          call_other_numbers: settings.call_other_numbers,
          voice: settings.voice,
          quiet_hours: settings.quiet_hours,
          quiet_hours_mode: settings.quiet_hours_mode,
          timezone: settings.timezone,
          daily_limit: settings.daily_limit,
          max_message_length: settings.max_message_length,
        });
      }),
  );
}
