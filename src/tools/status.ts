// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';

import type { Config } from '../config.js';
import { explain, fetchCall } from '../twilio.js';
import { asJson, runTool } from './shared.js';

export function registerStatusTool(server: McpServer, config: Config): void {
  server.registerTool(
    'tel_status',
    {
      description:
        'How a call placed by tel_call or tel_call_number went: answered, busy, no answer, and how long it lasted. ' +
        'Needed only when the call was placed with wait: false or was still going when the tool returned.',
      annotations: { title: 'Call status', readOnlyHint: true, openWorldHint: true },
      inputSchema: z.object({ call_id: z.string().describe('The sid returned by the call, starting with CA.') }),
    },
    async ({ call_id }) =>
      runTool(async () => {
        const info = await fetchCall(config.keys, call_id);
        return asJson({ ...info, meaning: explain(info) });
      }),
  );
}
