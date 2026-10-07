// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Karel Derfl

/**
 * A failure a tool reports to the assistant: a stable code it can branch on
 * and a sentence it can repeat to the user.
 */
export class ToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

/** A configuration problem found at startup. Read by a person in the log, so in Czech. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
