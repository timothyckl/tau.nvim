/**
 * agent.ts
 *
 * the main agent loop. wires together provider, session, tools, queue,
 * compaction, and extensions. emits AgentEvent values consumed by renderers.
 */

import type { AgentEvent, Provider, Tool } from "./types.js"
import type { Session } from "./session.js"
import type { MessageQueue } from "./queue.js"
import type { ExtensionRegistry } from "./extensions.js"
import type { CompactionSettings } from "./compaction.js"

// ---------------------------------------------------------------------------
// agent configuration
// ---------------------------------------------------------------------------

/**
 * all configuration required to create and run an agent instance.
 * tools are not listed here — they are sourced from `extensions.tools` at runtime.
 */
export type AgentConfig = {
  provider: Provider
  session: Session
  queue: MessageQueue
  extensions: ExtensionRegistry
  compaction: CompactionSettings
  model: string
  maxTokens?: number
  thinking?: boolean
  systemPrompt?: string
}

// ---------------------------------------------------------------------------
// agent interface
// ---------------------------------------------------------------------------

/**
 * a running agent instance. call run() to process the next user message,
 * which drives the full loop until turn_end or an error.
 */
export interface Agent {
  /**
   * runs a single user turn: sends the message, streams the model response,
   * executes any tool calls, checks the queue after each tool, and emits
   * events throughout. resolves when the turn is complete.
   *
   * @param userMessage - the user text to send for this turn
   */
  run(userMessage: string): AsyncIterable<AgentEvent>

  /**
   * aborts the current turn if one is running. queued messages are preserved.
   * no-op if no turn is in progress.
   */
  abort(): void

  /** returns true if a turn is currently in progress */
  readonly isRunning: boolean

  /**
   * updates the model used for subsequent turns.
   *
   * @param model - the new model id
   */
  setModel(model: string): void
}

// ---------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------

/**
 * creates a new agent instance bound to the given configuration.
 *
 * @param config - all dependencies and options for this agent
 */
export function createAgent(config: AgentConfig): Agent {
  throw new Error("not implemented")
}
