/**
 * bash.ts
 *
 * built-in bash tool: runs a shell command and returns its output.
 */

import type { Tool } from "../types.js"

/** default timeout for bash commands in milliseconds */
export const DEFAULT_BASH_TIMEOUT_MS = 30_000

/**
 * input schema for the bash tool.
 */
export type BashInput = {
  /** the shell command to execute */
  command: string
  /** optional timeout in milliseconds (default: 30000) */
  timeoutMs?: number
}

/**
 * runs the given shell command and returns a string combining stdout and
 * stderr. respects the timeout; throws a clean error on timeout or non-zero
 * exit code.
 *
 * @param input - command and optional timeout
 */
export async function runBash(input: BashInput): Promise<string> {
  throw new Error("not implemented")
}

/** the Tool definition for the bash tool, as registered with the agent loop */
export const bashTool: Tool = {
  name: "bash",
  description: "Run a shell command and return its output (stdout + stderr).",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "the shell command to run" },
      timeoutMs: { type: "number", description: "timeout in milliseconds (default: 30000)" },
    },
    required: ["command"],
  },
  execute: (input) => runBash(input as BashInput),
}
