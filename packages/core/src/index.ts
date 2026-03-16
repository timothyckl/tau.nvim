/**
 * index.ts
 *
 * public api surface of @tau/core. re-exports everything consumers need.
 */

// types — the foundational contracts
export type {
  AgentEvent,
  AgentEventType,
  CommandContext,
  CommandHandler,
  CompactionNeededEvent,
  EventHandler,
  ExtensionAPI,
  ExtensionFactory,
  JSONSchema,
  JSONSchemaProperty,
  MessageContent,
  MessageNode,
  Provider,
  QueuedMessage,
  RpcInboundCommand,
  RpcOutboundEvent,
  SessionHeader,
  SessionReader,
  StreamOptions,
  Tool,
} from "./types.js"

// session
export { loadSession, createSession, resolveSessionPath, SESSION_VERSION } from "./session.js"
export type { Session } from "./session.js"

// queue
export { createQueue } from "./queue.js"
export type { MessageQueue } from "./queue.js"

// agent
export { createAgent } from "./agent.js"
export type { Agent, AgentConfig } from "./agent.js"

// compaction
export {
  runCompaction,
  shouldCompact,
  findCutoffNode,
  DEFAULT_COMPACTION_SETTINGS,
} from "./compaction.js"
export type { CompactionSettings, CompactionOptions } from "./compaction.js"

// extensions
export {
  loadExtensions,
  discoverExtensionPaths,
  createRegistry,
} from "./extensions.js"
export type {
  ExtensionRegistry,
  LoadExtensionsOptions,
} from "./extensions.js"

// tools
export { readTool, readFile } from "./tools/read.js"
export { writeTool, writeFile } from "./tools/write.js"
export { editTool, editFile } from "./tools/edit.js"
export { bashTool, runBash, DEFAULT_BASH_TIMEOUT_MS } from "./tools/bash.js"

// providers
export { createAnthropicProvider } from "./providers/anthropic.js"
export { createOpenAICompatProvider } from "./providers/openai-compat.js"

/** the complete default built-in tool set */
export { BUILTIN_TOOLS } from "./tools/index.js"
