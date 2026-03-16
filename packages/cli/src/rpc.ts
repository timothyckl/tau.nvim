/**
 * rpc.ts
 *
 * rpc mode renderer. reads newline-delimited json commands from stdin and
 * writes newline-delimited json events to stdout. see docs/rpc-protocol.md.
 */

import type { Agent, RpcInboundCommand, RpcOutboundEvent } from "@tau/core"

// ---------------------------------------------------------------------------
// rpc runner
// ---------------------------------------------------------------------------

/**
 * configuration for the rpc runner.
 */
export type RpcRunnerConfig = {
  agent: Agent
  /** called to emit an outbound event to stdout */
  emit: (event: RpcOutboundEvent) => void
}

/**
 * starts the rpc input loop: reads stdin line by line, parses each line as
 * a RpcInboundCommand, and dispatches to the agent. emits outbound events
 * for every AgentEvent and meta event (ready, session_info, etc.).
 *
 * @param config - agent and emit callback
 */
export async function startRpcRunner(config: RpcRunnerConfig): Promise<void> {
  throw new Error("not implemented")
}

// ---------------------------------------------------------------------------
// serialisation helpers
// ---------------------------------------------------------------------------

/**
 * serialises an outbound event to a newline-terminated json string and writes
 * it to the given writable stream.
 *
 * @param event - the event to serialise
 * @param stream - the writable stream to write to (default: process.stdout)
 */
export function emitEvent(
  event: RpcOutboundEvent,
  stream: NodeJS.WritableStream = process.stdout,
): void {
  throw new Error("not implemented")
}

/**
 * parses a single stdin line as a RpcInboundCommand. throws a descriptive
 * error if the line is not valid json or does not match a known command type.
 *
 * @param line - the raw utf-8 line from stdin (no trailing newline)
 */
export function parseCommand(line: string): RpcInboundCommand {
  throw new Error("not implemented")
}
