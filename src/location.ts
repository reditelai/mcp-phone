// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

/**
 * Where the server runs from, and what that says about the defaults.
 *
 * Released as one bundled file (mcp-phone.mjs). In Miládka it lives in her
 * add-on folder, `<vault>/.doplnky/mcp-phone/` (`.addons` in the English
 * package), next to the other add-ons.
 */

import { statSync } from 'node:fs';
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

/**
 * Why the server will not run here, or null when it may. The add-on belongs to
 * Miládka and runs only from her add-on folder, in a folder that has
 * `.miladka/VERSION` (Karel, 8. 10. 2026). A build from source, not bundled,
 * runs anywhere, for development.
 */
export function outsideMiladka(
  serverFile: string = fileURLToPath(import.meta.url),
  bundled: boolean = bundledVersion() !== null,
): string | null {
  if (!bundled) return null;
  const addons = dirname(dirname(serverFile));
  if (ADDON_DIRS[basename(addons)] === undefined) {
    return `program neleží ve složce doplňků Miládky (.doplnky/mcp-phone/), ale v ${dirname(serverFile)}`;
  }
  const version = join(dirname(addons), '.miladka', 'VERSION');
  try {
    if (statSync(version).isFile()) return null;
  } catch {
    // reported below
  }
  return `ve složce ${dirname(addons)} chybí .miladka/VERSION, není to složka Miládky`;
}

/**
 * What the server says when it will not start outside Miládka, the same for
 * every reason: a person outside Miládka needs Miládka, not a path (Karel,
 * 8. 10. 2026). Inside Miládka the assistant finds the cause from .mcp.json.
 */
export function miladkaRequired(): string {
  return (
    'mcp-phone je doplněk Miládky a funguje jen v ní. Pořiďte si Miládku na https://miladka.cz a doplněk si nainstalujte v ní.\n' +
    'mcp-phone is an add-on for Miládka and works only inside her. Get Miládka at https://miladka.cz and install the add-on there.'
  );
}
