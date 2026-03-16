/**
 * write.ts
 *
 * built-in write tool: creates or overwrites a file.
 */

import type { Tool } from "../types.js"

/**
 * input schema for the write tool.
 */
export type WriteInput = {
  /** absolute or relative path to the file to write */
  path: string
  /** the full content to write */
  content: string
}

/**
 * writes content to a file, creating it if it does not exist or overwriting
 * it if it does. parent directories are created as needed. returns a short
 * confirmation string.
 *
 * @param input - path and content to write
 */
export async function writeFile(input: WriteInput): Promise<string> {
  throw new Error("not implemented")
}

/** the Tool definition for the write tool, as registered with the agent loop */
export const writeTool: Tool = {
  name: "write",
  description: "Write content to a file, creating or overwriting it.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "absolute or relative path to the file" },
      content: { type: "string", description: "full content to write" },
    },
    required: ["path", "content"],
  },
  execute: (input) => writeFile(input as WriteInput),
}
