// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

/**
 * Where the server runs from, and what that says about the defaults.
 *
 * Released as one bundled file (mcp-phone.mjs). In Miládka it lives in her
 * add-on folder, `<vault>/.doplnky/mcp-phone/` (`.addons` in the English
 * package), next to the other add-ons.
 */

import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Set by the bundler (npm run bundle); undefined when run from dist/. */
declare const __PH_VERSION__: string | undefined;

/** Version of the bundled file, or null when running from a clone. */
export function bundledVersion(): string | null {
  return typeof __PH_VERSION__ === 'string' ? __PH_VERSION__ : null;
}

/** Add-on folder name to the name of the passwords file in that language. */
const ADDON_DIRS: Record<string, string> = {
  '.doplnky': 'hesla.json',
  '.addons': 'passwords.json',
};

function addonsDir(): string | null {
  try {
    const addons = dirname(dirname(fileURLToPath(import.meta.url)));
    return ADDON_DIRS[basename(addons)] !== undefined ? addons : null;
  } catch {
    return null;
  }
}

/** The root of Miládka's folder when the server runs from her add-on folder, else null. */
export function vaultRoot(): string | null {
  const addons = addonsDir();
  return addons === null ? null : dirname(addons);
}

/** Default settings file inside Miládka: `system/phone.json`. Null outside her folder. */
export function vaultConfigPath(): string | null {
  const root = vaultRoot();
  return root === null ? null : join(root, 'system', 'phone.json');
}

/**
 * Default passwords file inside Miládka: `.miladka/secrets/phone/hesla.json`
 * (`passwords.json` in English), the same place Multigmail keeps its
 * passwords. Null outside her folder.
 */
export function vaultPasswordsPath(): string | null {
  const addons = addonsDir();
  if (addons === null) return null;
  const file = ADDON_DIRS[basename(addons)] ?? 'hesla.json';
  return join(dirname(addons), '.miladka', 'secrets', 'phone', file);
}
