/**
 * edit.ts
 *
 * built-in edit tool: performs exact string replacement within a file.
 */

import type { Tool } from "../types.js"

/**
 * input schema for the edit tool.
 */
export type EditInput = {
  /** absolute or relative path to the file to edit */
  path: string
  /** the exact string to find and replace */
  oldString: string
  /** the replacement string */
  newString: string
}

/**
 * replaces the first occurrence of `oldString` with `newString` in the file
 * at `path`. throws a clean error if `oldString` is not found or if it
 * appears more than once (ambiguous edit).
 *
 * @param input - path, target string, and replacement string
 */
export async function editFile(input: EditInput): Promise<string> {
  throw new Error("not implemented")
}

/** the Tool definition for the edit tool, as registered with the agent loop */
export const editTool: Tool = {
  name: "edit",
  description:
    "Replace an exact string within a file. Fails if the string is not found or appears more than once.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "absolute or relative path to the file" },
      oldString: { type: "string", description: "exact string to replace" },
      newString: { type: "string", description: "replacement string" },
    },
    required: ["path", "oldString", "newString"],
  },
  execute: (input) => editFile(input as EditInput),
}
