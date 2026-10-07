// Tests of the Miládka check (src/location.ts): the add-on runs only from her add-on folder.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { outsideMiladka } from '../dist/location.js';

function vault({ addons = '.doplnky', version = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ph-vault-'));
  const dir = join(root, addons, 'mcp-phone');
  mkdirSync(dir, { recursive: true });
  if (version) {
    mkdirSync(join(root, '.miladka'));
    writeFileSync(join(root, '.miladka', 'VERSION'), '2.0.0\n');
  }
  return join(dir, 'mcp-phone.mjs');
}

test('the released file runs from the add-on folder of a Miládka folder', () => {
  assert.equal(outsideMiladka(vault(), true), null);
  assert.equal(outsideMiladka(vault({ addons: '.addons' }), true), null);
});

test('the released file refuses to run anywhere else', () => {
  assert.match(outsideMiladka(vault({ version: false }), true), /\.miladka\/VERSION/);
  assert.match(outsideMiladka(vault({ addons: 'programy' }), true), /složce doplňků/);
  assert.match(outsideMiladka(join(tmpdir(), 'mcp-phone.mjs'), true), /složce doplňků/);
});

test('a build from source runs anywhere', () => {
  assert.equal(outsideMiladka(join(tmpdir(), 'mcp-phone.mjs'), false), null);
});
