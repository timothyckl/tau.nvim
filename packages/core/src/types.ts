/**
 * types.ts
 *
 * all foundational shared types for tau. lock these down before writing any
 * implementation. this file has no runtime dependencies.
 */

// ---------------------------------------------------------------------------
// json schema (minimal subset sufficient for tool input schemas)
// ---------------------------------------------------------------------------

export type JSONSchema = {
  type: "object"
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  additionalProperties?: boolean
}

export type JSONSchemaProperty =
  | { type: "string"; description?: string; enum?: string[] }
  | { type: "number"; description?: string }
  | { type: "integer"; description?: string }
  | { type: "boolean"; description?: string }
  | { type: "array"; items?: JSONSchemaProperty; description?: string }
  | { type: "object"; properties?: Record<string, JSONSchemaProperty>; description?: string }

// ---------------------------------------------------------------------------
// session / message types
// ---------------------------------------------------------------------------

/**
 * the content payload of a message node. discriminated by `type`.
 */
export type MessageContent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; id: string; input: unknown }
  | { type: "tool_result"; toolCallId: string; result: string }
  | { type: "summary"; text: string } // synthetic compaction node

/**
 * one node in the jsonl session tree. every node has a parent except the root.
 */
export type MessageNode = {
  id: string // uuid v4
  parentId: string | null // null only for the root node
  role: "user" | "assistant" | "tool_result" | "summary"
  content: MessageContent
  timestamp: number // unix ms
  meta?: {
    model?: string // which model produced this node
    tokens?: number // token count for this node
    cost?: number // usd
  }
}

/**
 * the header line written as the first line of every session jsonl file.
 */
export type SessionHeader = {
  type: "tau-session"
  version: number
}

// ---------------------------------------------------------------------------
// agent events — the event bus between core and renderers
// ---------------------------------------------------------------------------

/**
 * all events emitted by the agent loop. both renderers (tui and rpc) subscribe
 * to this union. the union is closed — adding a new variant requires updating
 * every consumer.
 */
export type AgentEvent =
  | { type: "thinking"; text: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; name: string; id: string; input: unknown }
  | { type: "tool_call_end"; id: string; result: string }
  | { type: "turn_end" }
  | { type: "error"; error: Error }
  | { type: "compaction_start" }
  | { type: "compaction_end" }

/** string literal union of all agent event type tags */
export type AgentEventType = AgentEvent["type"]

// ---------------------------------------------------------------------------
// message queue
// ---------------------------------------------------------------------------

/**
 * a message queued while the agent is running.
 *
 * - steering: delivered after the current tool call completes; discards any
 *   remaining queued tool calls. use to redirect mid-task.
 * - followup: delivered only after the full agent turn ends.
 */
export type QueuedMessage =
  | { kind: "steering"; text: string }
  | { kind: "followup"; text: string }

// ---------------------------------------------------------------------------
// tools
// ---------------------------------------------------------------------------

/**
 * a tool the llm can call. execute receives validated input and returns a
 * string result sent back to the model.
 */
export type Tool = {
  name: string
  description: string
  inputSchema: JSONSchema
  execute: (input: unknown) => Promise<string>
}

// ---------------------------------------------------------------------------
// providers
// ---------------------------------------------------------------------------

/** options passed to every provider stream call */
export type StreamOptions = {
  model: string
  maxTokens?: number
  thinking?: boolean
  thinkingBudget?: number
  systemPrompt?: string
}

/**
 * the interface both providers (anthropic and openai-compat) must implement.
 * neither provider should depend on the agent loop.
 */
export interface Provider {
  /**
   * streams agent events for a single llm turn.
   *
   * @param messages - the active branch of the session tree
   * @param tools - tools available to the model this turn
   * @param options - model and generation options
   */
  stream(
    messages: MessageNode[],
    tools: Tool[],
    options: StreamOptions,
  ): AsyncIterable<AgentEvent>

  /**
   * returns the token count for the given messages without making a generation
   * call. used by the compaction logic.
   *
   * @param messages - messages to count tokens for
   */
  countTokens(messages: MessageNode[]): Promise<number>
}

// ---------------------------------------------------------------------------
// extensions
// ---------------------------------------------------------------------------

/** read-only session surface exposed to extensions */
export interface SessionReader {
  activeBranch(): MessageNode[]
  tree(): MessageNode[]
  readonly path: string
}

/** context passed to slash command handlers */
export type CommandContext = {
  /**
   * in tui mode: display output in the message list.
   * in rpc mode: emit as a `command_output` event on stdout.
   */
  output(text: string): void
}

/** handler for a registered slash command */
export type CommandHandler = (args: string, ctx: CommandContext) => Promise<void>

/** handler for an agent lifecycle event */
export type EventHandler = (event: AgentEvent) => void | Promise<void>

/**
 * the renderer-agnostic extension api exposed to all extensions.
 * extensions that only use this interface work in both tui and rpc mode.
 */
export type ExtensionAPI = {
  /** register a new tool the llm can call */
  registerTool(tool: Tool): void

  /**
   * override a built-in tool. the override must re-implement execution
   * entirely — there is no way to call through to the original.
   */
  overrideTool(name: string, tool: Tool): void

  /** listen to agent lifecycle events */
  on(event: AgentEventType, handler: EventHandler): void

  /** register a slash command */
  registerCommand(name: string, handler: CommandHandler): void

  /**
   * register a handler for the compaction_needed event. the first handler to
   * call event.resolve() wins; subsequent calls are ignored. kept separate from
   * on() because the handler returns a promise and carries a resolve callback.
   */
  onCompactionNeeded(handler: (event: CompactionNeededEvent) => Promise<void>): void

  /** read-only access to the current session */
  session: SessionReader

  /** emit a notification in the current renderer */
  notify(message: string, level?: "info" | "warn" | "error"): void
}

/** default export signature every extension file must satisfy */
export type ExtensionFactory = (api: ExtensionAPI) => void

// ---------------------------------------------------------------------------
// compaction
// ---------------------------------------------------------------------------

/**
 * the event passed to `compaction_needed` handlers. the first extension to
 * call resolve() wins; subsequent calls are ignored.
 */
export type CompactionNeededEvent = {
  messages: MessageNode[]
  resolve: (summaryText: string) => void
}

// ---------------------------------------------------------------------------
// rpc protocol — inbound commands (neovim → process)
// ---------------------------------------------------------------------------

export type RpcInboundCommand =
  | { type: "prompt"; text: string; kind?: "steering" | "followup" }
  | { type: "abort" }
  | { type: "branch"; nodeId: string }
  | { type: "session"; action: "info" | "compact" | "tree"; instructions?: string }
  | { type: "config"; key: string; value: unknown }

// ---------------------------------------------------------------------------
// rpc protocol — outbound events (process → neovim)
// ---------------------------------------------------------------------------

export type RpcOutboundEvent =
  | AgentEvent
  | { type: "ready"; model: string; provider: string; sessionId: string }
  | { type: "session_info"; sessionId: string; path: string; nodeCount: number; activeNodeId: string }
  | { type: "session_tree"; nodes: MessageNode[] }
  | { type: "command_output"; text: string }
