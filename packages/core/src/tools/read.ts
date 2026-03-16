/**
 * read.ts
 *
 * built-in read tool: returns the contents of a file.
 */

import type { Tool } from "../types.js"

/**
 * input schema for the read tool.
 */
export type ReadInput = {
  /** absolute or relative path to the file to read */
  path: string
  /** optional line range: 1-based start line (inclusive) */
  startLine?: number
  /** optional line range: 1-based end line (inclusive) */
  endLine?: number
}

/**
 * reads a file from disk and returns its contents as a string. throws a clean
 * error message (not a raw node error) if the file does not exist.
 *
 * @param input - path and optional line range
 */
export async function readFile(input: ReadInput): Promise<string> {
  throw new Error("not implemented")
}

/** the Tool definition for the read tool, as registered with the agent loop */
export const readTool: Tool = {
  name: "read",
  description: "Read the contents of a file. Returns the file contents as a string.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "absolute or relative path to the file" },
      startLine: { type: "number", description: "1-based start line (inclusive)" },
      endLine: { type: "number", description: "1-based end line (inclusive)" },
    },
    required: ["path"],
  },
  execute: (input) => readFile(input as ReadInput),
}
