/**
 * index.ts
 *
 * collects the default built-in tools into a single array.
 */

import type { Tool } from "../types.js"
import { readTool } from "./read.js"
import { writeTool } from "./write.js"
import { editTool } from "./edit.js"
import { bashTool } from "./bash.js"

/** the default set of built-in tools registered before any extensions load */
export const BUILTIN_TOOLS: Tool[] = [readTool, writeTool, editTool, bashTool]
